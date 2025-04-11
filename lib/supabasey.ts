import {
	createClient as Supabase,
	SupabaseClient
} from '@supabase/supabase-js'
import pRetry from 'p-retry';

import { SupabaseyCallable, SupabaseyCallback, SupabaseyOptions, BoundSupabaseyFunction } from './types.js';

/**
 * Wraps a Supabase query function (like `supabase.from(...).select()`) with
 * promise-like behavior and automatic retries. It ensures that errors are thrown
 * and only the data part of the response is returned on success.
 *
 * @template T The expected type of the data resolved from the Supabase query.
 *
 * @param cb The asynchronous Supabase query function to execute. It receives the
 *   Supabase client instance as its first argument and `this` context.
 *   Example: `(supabase) => supabase.from('users').select('*').limit(1).single()`
 *
 * @param options Configuration options for the wrapper.
 * @param options.session Either a string identifier for a registered Supabase session
 *   (see `supabasey.sessions`) or a direct `SupabaseClient` instance to use.
 * @param [options.retries=3] The number of times to retry the query function if it fails.
 *   This is a shorthand for setting `options.retry.retries`.
 * @param [options.retry] Advanced retry options passed directly to the `p-retry` library.
 *   See `p-retry` documentation for details. If `retries` is specified here, it overrides
 *   `options.retries`.
 *
 * @returns A Promise that resolves with the `data` property of the successful Supabase
 *   query response.
 * @throws Throws an error if the callback is not a function, if the session is invalid,
 *   if the Supabase query results in an error after retries, or if `p-retry` fails.
 */
let coreSupabasey = function Supabasey<T = any>(
	cb: SupabaseyCallback<T>,
	options?: SupabaseyOptions
): Promise<T> {
	// Sanity checks
	if (typeof cb != 'function') throw new Error('First argument to supabasey() must be a callback function');

	let settings = {
		session: null,
		retries: 3,
		retry: {
			minTimeout: 100,
			factor: 2, // Exponential backoff factor
			randomize: true, // Try to randomize timeouts
			onFailedAttempt: (e: any) => console.info(`[Attempt ${e.attemptNumber}/${e.attemptNumber + e.retriesLeft - 1}] failed to run Supabase query`),
			shouldRetry: (e: any) => {
				console.log('QUERY SHOULD-RETRY', e);
				return true;
			},
		},
		...options,
	};

	// Determine active session
	let supabaseClient =
		!settings.session ? (()=> { throw new Error('supabasey(cb, {session}) cannot be empty') })()
		: typeof settings.session == 'string' ? supabasey.sessions[settings.session] // Lookup by session ID
		: typeof settings.session == 'object' ? settings.session // Assume we are being passed a raw Supabase client
		: (()=> { throw new Error(`Unknown session type for supabasey(cb, {session}) - expected Object|String got ${typeof settings.session}`) })();

	return Promise.resolve()
		.then(()=> pRetry(
			()=> cb.call(supabaseClient, supabaseClient),
			{
				...(settings.retries && {retries: settings.retries}),
				...options.retry,
			},
		))
		.then(res => {
			if (res?.error) {
				supabasey.throw(res.error);
			} else if (res.data) { // Do we have output data
				return res.data;
			}
		})
		.catch(e => {
			console.log('Supabasey error:', e);
			throw e;
		})
}

// Cast the core function to the full type
const supabasey = coreSupabasey as SupabaseyCallable;

/**
 * Creates a pre-configured version of the `supabasey` function that is bound
 * to a specific Supabase session. This avoids needing to pass the `session`
 * option in every call.
 *
 * @param session The session identifier (string key in `supabasey.sessions`) or
 *   a direct `SupabaseClient` instance to bind to.
 * @returns A function with the same signature as `supabasey`, but without requiring
 *   the `options.session` property.
 * @throws If attempting to bind to a non-existent session identifier (string).
 */
supabasey.bindSession = function supabaseySession(session) {
	if (typeof session == 'string' && !supabasey.sessions[session]) throw new Error(`Unable to bind to non-existant session "${session}"`);

	return (cb, options) => supabasey(cb, {
		session,
		...options,
	});
}


/**
 * Initializes a Supabase client, optionally logs in a user, registers the session,
 * and returns a `supabasey` function bound to that session.
 *
 * @param [options] Configuration options for initialization.
 * @param [options.env={}] An object containing environment variables (e.g., from `process.env`
 *   or Cloudflare Worker bindings). Used to source Supabase URL, key, user, and password.
 * @param [options.init=true] If true, creates a new Supabase client using `env.SUPABASE_URL`
 *   and `env.SUPABASE_KEY` if a session with the determined key doesn't already exist.
 * @param [options.login=true] If true, attempts to log in using `env.SUPABASE_USER` and
 *   `env.SUPABASE_PASS` after ensuring the client is initialized. Skips if already logged in for this session.
 * @param [options.session='auto'] Determines the key for storing the session in `supabasey.sessions`.
 *   If 'auto', uses `env.SUPABASE_URL`. Otherwise, uses the provided string.
 *
 * @returns A Promise resolving to the `supabasey` function wrapper, pre-bound to the
 *   initialized (and potentially logged-in) session (same response as `supabasey.bindSession`).
 * @throws If required environment variables are missing for the enabled options (init/login),
 *   or if initialization fails.
 */
supabasey.init = function supabaseyInit(options) {
	let settings = {
		env: {},
		init: true,
		login: true,
		session: 'auto',
		...options,
	};
	let env = settings.env;

	// Determine sessionKey + session (if active) {{{
	let sessionKey =
		settings.session == 'auto' && env.SUPABASE_URL ? env.SUPABASE_URL
		: settings.session ? settings.session
		: (()=> {
			throw new Error('Sesison should be truthy if using @iebh/supabasey.middleware({session:String})');
		})();

	let session = supabasey.sessions[sessionKey];
	// }}}

	return Promise.resolve()
		.then(()=> { // Init {{{
			if (session) {  // Already have an active session?
				return;
			} else if (settings.init) { // No session but we are allowed to init
				if (!env.SUPABASE_URL || !env.SUPABASE_KEY) throw new Error('Both env.SUPABASE_URL + env.SUPABASE_KEY should be specified to use @iebh/supabasey.middleware(), otherwise disable with {init:false}');
				session = supabasey.sessions[sessionKey] = Supabase(env.SUPABASE_URL, env.SUPABASE_KEY);
			} else {
				throw new Error('No Supabase session for middleware to work with!');
			}
		}) // }}}
		.then(()=> { // Login {{{
			if (!settings.login) { // Login not required OR already logged in
				return; // Login is disabled anyway
			} else if (session.supabaseyIsLoggedIn) { // Alrady logged in?
				return;
			} else if (!env.SUPABASE_USER || !env.SUPABASE_PASS) {
				throw new Error('User credentials missing when using @iebh/supabasey.middleware(), provide in env.SUPABASE_USER + ..._PASS');
			} else {
				return supabasey(s => s.auth.signInWithPassword({
					email: env.SUPABASE_USER,
					password: env.SUPABASE_PASS,
				}), {session})
					.then(()=> session.supabaseyIsLoggedIn = true) // Mark session as in use
			}
		}) // }}}
		.then(()=> supabasey.bindSession(session))
}


/**
 * Creates an Express/Connect/Cloudflare Worker style middleware function that initializes
 * Supabase using `supabasey.init` on each request.
 *
 * This is primarily a convenience wrapper around `supabasey.init`.
 *
 * @param [options] Configuration options, passed down to `supabasey.init`.
 * @param [options.env] Environment variables (often provided by the framework, e.g., `env` in CF Workers).
 *   If not provided here, the middleware will expect it as the third argument (`env`) during execution.
 * @param [options.injectEnv=true] If true, the bound `supabasey` function will be attached
 *   to the environment object (passed as the third argument to the middleware) as `env.supabase`.
 * @param [options...] Other options are forwarded to `supabasey.init`.
 *
 * @returns An async middleware function compatible with frameworks like Express or Cloudflare Workers.
 *   It expects arguments like `(req, res_or_env, next_or_env, next)`. The exact signature depends
 *   on the framework. For Cloudflare Workers: `(request, env, context) => Promise<Response>`. For Express:
 *   `(req, res, next) => Promise<void>`. This implementation tries to be flexible but assumes
 *   an `env` object will be available somehow (either via options or middleware args).
 */
supabasey.middleware = function supabaseyMiddleware(options) {
	let settings = {
		env: {},
		injectEnv: true,
		...options,
	};

	/**
	* Supabasey middleware worker function
	*
	* @param {Object} req The middleware request object
	* @param {Object} res The middleware response object
	* @param {Object} env The active environment
	* @param {Function} next Middleware next function
	* @returns {Function} Express / Cloudflare workers compatible middelware function
	*/
	return async (req, res, env, next) => {
		return supabasey.init({
			...options,
			env,
		})
			.then(supabasey => {
				if (settings.injectEnv) env.supabase = supabasey;
			})
			.catch(err => supabasey.throw(err))
	};
}


/**
 * Translates a Supabase error object (or other error types) into a standard JavaScript Error
 * and throws it. Aims to standardize error handling.
 *
 * @param err The raw error received, typically from a Supabase response (`res.error`) or a catch block.
 * @throws Always throws an Error object. Attempts to parse Supabase-specific errors for clarity.
 *   Specifically handles the "single()" method error when multiple/no rows are found, throwing 'NOT-FOUND'.
 */
supabasey.throw = function(err) {
	if (typeof err == 'string') { // Already a string
		throw new Error(err);
	} else if (err instanceof Error) { // Already an error
		throw err;
	} else if (/JSON object requested, multiple \(or no\) rows returned$/.test(err.message)) {
		console.warn('Supabase query resulted in NOT-FOUND:', err.message);
		console.warn('Supabase raw error', err);
		throw new Error('NOT-FOUND');
	} else {
		console.warn('Supabase query threw', err.message || err || 'Unknown error');
		throw new Error(`${err?.code || 'UnknownError'}: ${err?.message || 'Unknown Supabase error'}`);
	}
}

/**
* Convenience function to call a Supabase RPC function, wrapped in the usual Supabasey() function handler (with retry behaviour etc)
*
* @param method The method name to call
* @param [args] Optional named arguments to pass to the RPC function
* @param [options] Additional Supabasey wrapper options when calling the RPC functions - see `supabasey()` for details
*
* @returns The RPC function return, if any
*/
supabasey.rpc = function(
	method,
	args?,
	options?
) {
	return supabasey(async (s) => {
		const response = await s.rpc(method, args);
		return response;
	}, options);
}

/**
 * A registry for active Supabase client sessions. Keys are typically session identifiers
 * (like the Supabase URL or a custom string provided during init/bind), and values
 * are the corresponding `SupabaseClient` instances.
 *
 * @example
 * // After initializing with default 'auto' session:
 * console.log(supabasey.sessions['https://<project>.supabase.co']); // -> SupabaseClient instance
 */
supabasey.sessions = {};


export default supabasey;
// Named type exports
export { BoundSupabaseyFunction, SupabaseClient };

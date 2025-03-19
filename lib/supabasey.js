import {createClient as Supabase} from '@supabase/supabase-js'
import pRetry from 'p-retry';

/**
* Wrap a Supabase query so it works more like a classic-JS promise
*
* @function
*
* @param {Function} cb Async function to execute as `(supabase:SupabaseClient)` (with the supabase client as the context)
*
* @param {Object} [options] Additional options to mutate behaviour
* @param {String|SupabaseClient} session Either a named session or a Supabase client to bind to
* @param {Number} [options.retries=3] Number of times to attempt to rerun the query if it fails (utlity to auto-populate `options.retry.retries`)
* @param {Object} [options.retry] Raw options passed to p-retry / node-retry (overrides `options.retries` if `retries` is present)
*
* @returns {Promise<Object>} The data response as a POJO (or a throw if the query errored out)
*/
let supabasey = function supabasy(cb, options) {
	// Sanity checks
	if (typeof cb != 'function') throw new Error('First argument to supabasey() must be a callback function');

	let settings = {
		session: null,
		retries: 3,
		retry: {
			minTimeout: 100,
			factor: 2, // Exponential backoff factor
			randomize: true, // Try to randomize timeouts
			onFailedAttempt: e => console.info(`[Attempt ${e.attemptNumber}/${e.attemptNumber + e.retriesLeft - 1}] failed to run Supabase query`),
			shouldRetry: e => {
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
		: (()=> { throw new Error('Unknown session type for supabasey(cb, {session})') })();

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


/**
* Returns a Supabasey() wrapped function bound to the named session
* This is the curried version of `supabasey(cb, {session:String})`
*
* @param {String|SupabaseClient} session The session to bind to
*/
supabasey.bindSession = function supabaseySession(session) {
	if (typeof session == 'string' && !supabasey.sessions[session]) throw new Error(`Unable to bind to non-existant session "${session}"`);

	return (cb, options) => supabasey(cb, {
		session,
		...options,
	});
}


/**
* Initialize Supabase, returning a Supabase session
*
* @param {Object} [options] Additional options to mutate behaviour
* @param {Object} [options.env] Environment config to take various settings from
* @param {Boolean} [options.init=true] Use `env.SUPABASE_URL` + `env.SUPABASE_KEY` to login to Supabase, disable if some higher function handles this automatically
* @param {Boolean} [options.login=true] Use `env.SUPABASE_USER` + `env.SUPABASE_PASS` to login as that Supabase meta-user
* @param {'auto'|String} [options.session='auto'] The supabase session to use, if 'auto' uses `env.SUPABASE_URL`
*
* @returns {Promise<SupabaseClient>} A promise which resolves with the initalized Supabase client
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
				console.log('DEBUG: Create session', sessionKey);
			} else {
				throw new Error('No Supabase session for middleware to work with!');
			}
		}) // }}}
		.then(()=> { // Login {{{
			if (!settings.login) { // Login not required OR already logged in
				console.log('DEBUG: No login needed', sessionKey);
				return; // Login is disabled anyway
			} else if (session.supabaseyIsLoggedIn) { // Alrady logged in?
				console.log('DEBUG: Reuse existing login', sessionKey);
				return;
			} else if (!env.SUPABASE_USER || !env.SUPABASE_PASS) {
				throw new Error('User credentials missing when using @iebh/supabasey.middleware(), provide in env.SUPABASE_USER + ..._PASS');
			} else {
				return supabasey(s => s.auth.signInWithPassword({
					email: env.SUPABASE_USER,
					password: env.SUPABASE_PASS,
				}), {session})
					.then(()=> console.log('DEBUG: New session', sessionKey))
					.then(()=> session.supabaseyIsLoggedIn = true) // Mark session as in use
			}
		}) // }}}
		.then(()=> session)
}


/**
* Initialize Supabase as a middleware function
* This function is designed with Cloudflare workers in mind but should be generically compatible with any Express style middleware
*
* This middleware is actually a wrapper around `supabasey.init(env, options)`
*
* @param {Object} [options] Additional options to mutate behaviour, see supabasey.init() for details
* @param {Object} [options.env] Environment variables to use for various initialization functions
* @param {Boolean} [options.injectEnv=true] If truthy add `env.supabase` as a handle to this Supabase session
* @param {*...} [options...] Other options, see `supabasey.init()
*
* @returns {Function} Express / Cloudflare worker middleware function, expects to be called as `(req:Object, res:Object, env:Object)`
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
			.then(session => {
				if (settings.injectEnv) env.supabase = supabasey.bindSession(session);
			})
			.catch(err => supabasey.throw(err))
	};
}


/**
* Translate and throw a Supabase error object into a single JS Error object
*
* @param {Object} err The raw Supabase error object to translate
*/
supabasey.throw = function(err) {
	if (typeof err == 'string') { // Already a string
		throw new Error(err);
	} else if (err instanceof Error) { // Already an error
		throw err;
	} else if (/JSON object requested, multiple \(or no\) rows returned$/.test(err.message)) {
		console.warn('Supabase query threw record not found against query', query.url.search);
		console.warn('Supabase raw error', err);
		throw new Error('NOT-FOUND');
	} else {
		console.warn('Supabase query threw', err.error.message);
		throw new Error(`${err?.code || 'UnknownError'}: ${err.error?.message || 'Unknown Supabase error'}`);
	}
}



/**
* Active Supabase sessions
* This is a lookup object with each key as the Supabase URL
*
* @type {oBject}
*/
supabasey.sessions = {};


export default supabasey;

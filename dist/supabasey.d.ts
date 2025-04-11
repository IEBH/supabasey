export default supabasey;
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
declare function supabasey(cb: Function, options?: any): Promise<any>;
declare namespace supabasey {
    /**
    * Returns a Supabasey() wrapped function bound to the named session
    * This is the curried version of `supabasey(cb, {session:String})`
    *
    * @param {String|SupabaseClient} session The session to bind to
    */
    export function bindSession(session: string | SupabaseClient): (cb: any, options: any) => Promise<any>;
    /**
    * Initialize Supabase, returning a Supabase session
    *
    * @param {Object} [options] Additional options to mutate behaviour
    * @param {Object} [options.env] Environment config to take various settings from
    * @param {Boolean} [options.init=true] Use `env.SUPABASE_URL` + `env.SUPABASE_KEY` to login to Supabase, disable if some higher function handles this automatically
    * @param {Boolean} [options.login=true] Use `env.SUPABASE_USER` + `env.SUPABASE_PASS` to login as that Supabase meta-user
    * @param {'auto'|String} [options.session='auto'] The supabase session to use, if 'auto' uses `env.SUPABASE_URL`
    *
    * @returns {Promise<Supabasey>} A promise which resolves with the initalized Supabasey function wrapper (same response as `supabasey.bindSession`)
    */
    export function init(options?: {
        env?: any;
        init?: boolean;
        login?: boolean;
        session?: "auto" | string;
    }): Promise<Supabasey>;
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
    export function middleware(options?: {
        env?: any;
        injectEnv?: boolean;
    }): Function;
    /**
    * Translate and throw a Supabase error object into a single JS Error object
    *
    * @param {Object} err The raw Supabase error object to translate
    */
    function _throw(err: any): never;
    export { _throw as throw };
    export let sessions: any;
}
//# sourceMappingURL=supabasey.d.ts.map
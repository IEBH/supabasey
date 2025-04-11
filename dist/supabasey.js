"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var supabase_js_1 = require("@supabase/supabase-js");
var p_retry_1 = require("p-retry");
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
var supabasey = function supabasy(cb, options) {
    // Sanity checks
    if (typeof cb != 'function')
        throw new Error('First argument to supabasey() must be a callback function');
    var settings = __assign({ session: null, retries: 3, retry: {
            minTimeout: 100,
            factor: 2, // Exponential backoff factor
            randomize: true, // Try to randomize timeouts
            onFailedAttempt: function (e) { return console.info("[Attempt ".concat(e.attemptNumber, "/").concat(e.attemptNumber + e.retriesLeft - 1, "] failed to run Supabase query")); },
            shouldRetry: function (e) {
                console.log('QUERY SHOULD-RETRY', e);
                return true;
            },
        } }, options);
    // Determine active session
    var supabaseClient = !settings.session ? (function () { throw new Error('supabasey(cb, {session}) cannot be empty'); })()
        : typeof settings.session == 'string' ? supabasey.sessions[settings.session] // Lookup by session ID
            : typeof settings.session == 'object' ? settings.session // Assume we are being passed a raw Supabase client
                : (function () { throw new Error("Unknown session type for supabasey(cb, {session}) - expected Object|String got ".concat(typeof settings.session)); })();
    return Promise.resolve()
        .then(function () { return (0, p_retry_1.default)(function () { return cb.call(supabaseClient, supabaseClient); }, __assign(__assign({}, (settings.retries && { retries: settings.retries })), options.retry)); })
        .then(function (res) {
        if (res === null || res === void 0 ? void 0 : res.error) {
            supabasey.throw(res.error);
        }
        else if (res.data) { // Do we have output data
            return res.data;
        }
    })
        .catch(function (e) {
        console.log('Supabasey error:', e);
        throw e;
    });
};
/**
* Returns a Supabasey() wrapped function bound to the named session
* This is the curried version of `supabasey(cb, {session:String})`
*
* @param {String|SupabaseClient} session The session to bind to
*/
supabasey.bindSession = function supabaseySession(session) {
    if (typeof session == 'string' && !supabasey.sessions[session])
        throw new Error("Unable to bind to non-existant session \"".concat(session, "\""));
    return function (cb, options) { return supabasey(cb, __assign({ session: session }, options)); };
};
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
supabasey.init = function supabaseyInit(options) {
    var settings = __assign({ env: {}, init: true, login: true, session: 'auto' }, options);
    var env = settings.env;
    // Determine sessionKey + session (if active) {{{
    var sessionKey = settings.session == 'auto' && env.SUPABASE_URL ? env.SUPABASE_URL
        : settings.session ? settings.session
            : (function () {
                throw new Error('Sesison should be truthy if using @iebh/supabasey.middleware({session:String})');
            })();
    var session = supabasey.sessions[sessionKey];
    // }}}
    return Promise.resolve()
        .then(function () {
        if (session) { // Already have an active session?
            return;
        }
        else if (settings.init) { // No session but we are allowed to init
            if (!env.SUPABASE_URL || !env.SUPABASE_KEY)
                throw new Error('Both env.SUPABASE_URL + env.SUPABASE_KEY should be specified to use @iebh/supabasey.middleware(), otherwise disable with {init:false}');
            session = supabasey.sessions[sessionKey] = (0, supabase_js_1.createClient)(env.SUPABASE_URL, env.SUPABASE_KEY);
        }
        else {
            throw new Error('No Supabase session for middleware to work with!');
        }
    }) // }}}
        .then(function () {
        if (!settings.login) { // Login not required OR already logged in
            return; // Login is disabled anyway
        }
        else if (session.supabaseyIsLoggedIn) { // Alrady logged in?
            return;
        }
        else if (!env.SUPABASE_USER || !env.SUPABASE_PASS) {
            throw new Error('User credentials missing when using @iebh/supabasey.middleware(), provide in env.SUPABASE_USER + ..._PASS');
        }
        else {
            return supabasey(function (s) { return s.auth.signInWithPassword({
                email: env.SUPABASE_USER,
                password: env.SUPABASE_PASS,
            }); }, { session: session })
                .then(function () { return session.supabaseyIsLoggedIn = true; }); // Mark session as in use
        }
    }) // }}}
        .then(function () { return supabasey.bindSession(session); });
};
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
    var _this = this;
    var settings = __assign({ env: {}, injectEnv: true }, options);
    /**
    * Supabasey middleware worker function
    *
    * @param {Object} req The middleware request object
    * @param {Object} res The middleware response object
    * @param {Object} env The active environment
    * @param {Function} next Middleware next function
    * @returns {Function} Express / Cloudflare workers compatible middelware function
    */
    return function (req, res, env, next) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, supabasey.init(__assign(__assign({}, options), { env: env }))
                    .then(function (supabasey) {
                    if (settings.injectEnv)
                        env.supabase = supabasey;
                })
                    .catch(function (err) { return supabasey.throw(err); })];
        });
    }); };
};
/**
* Translate and throw a Supabase error object into a single JS Error object
*
* @param {Object} err The raw Supabase error object to translate
*/
supabasey.throw = function (err) {
    if (typeof err == 'string') { // Already a string
        throw new Error(err);
    }
    else if (err instanceof Error) { // Already an error
        throw err;
    }
    else if (/JSON object requested, multiple \(or no\) rows returned$/.test(err.message)) {
        console.warn('Supabase query threw record not found against query', query.url.search);
        console.warn('Supabase raw error', err);
        throw new Error('NOT-FOUND');
    }
    else {
        console.warn('Supabase query threw', err.message || err || 'Unknown error');
        throw new Error("".concat((err === null || err === void 0 ? void 0 : err.code) || 'UnknownError', ": ").concat((err === null || err === void 0 ? void 0 : err.message) || 'Unknown Supabase error'));
    }
};
/**
* Active Supabase sessions
* This is a lookup object with each key as the Supabase URL
*
* @type {Object}
*/
supabasey.sessions = {};
exports.default = supabasey;

@iebh/supabasey
===============
Utility function to wrap the main Supabase worker function.

Unlike calling `supabase.FUNCTION` / `supabase.auth.FUNCTION` etc. this function takes a simple callback which provides the following:

1. Flattens non-promise responses into then-ables
2. The query is forced to respond as a promise (prevents accidental query chaining)
3. The response data object is guaranteed to be a POJO return (if any data is returned, otherwise void)
4. Errors throw with a logical error message rather than a weird object return (see `supabesey.throw()`)
5. Retrying and back-off provided by default


API
===
This library exports a single function worker by default but also provides a few other utility function to make working with Supabase a little easier.

supabasey(callback, options)
----------------------------
The main worker function, accepts a function which is called as `(supabase:supabseClient)`.

```javascript
let responses = await env.supabase(s => s
    .from('widgets')
    .select('id, data')
)
```

Options are:


| Option    | Type     | Default | Description                                                                                                 |
|-----------|----------|---------|-------------------------------------------------------------------------------------------------------------|
| `retries` | `Number` | `3`     | Number of times to attempt to rerun the query if it fails (utlity to auto-populate `options.retry.retries`) |
| `retry`   | `Object` |         | Raw options passed to p-retry / node-retry, defaults are a suitable setup for Supabase                      |


supabasey.rpc(method, arguments, options)
-----------------------------------------
Convenience wrapper to call RPC functions.

```javascript
supabasey.rpc('hello_world');
// ...is the equivelent of...
supabasey(s => s.rpc('hello_world'))
```


supabasey.middleware(options)
-----------------------------
Middleware functionality to glue an initalized Supabase session into `env.supabase` for each request to an endpoint.
This function is designed with Cloudflare workers in mind but should be generically compatible with any Express style middleware
This middleware is actually a wrapper around `supabasey.init({env, ...options})`

Options are:

| Option      | Type      | Default | Description                                                       |
|-------------|-----------|---------|-------------------------------------------------------------------|
| `env`       | `Object`  | `{}`    | Environment variables to use for various initialization functions |
| `injectEnv` | `Boolean` | `true`  | If truthy add `env.supabase` as a handle to this Supabase session |


supabasey.init(options)
-----------------------
Initialize Supabase, returning a Supabasey wrapper function.

Options are:

| Option    | Type                | Default  | Description                                                                                                                  |
|-----------|---------------------|----------|------------------------------------------------------------------------------------------------------------------------------|
| `env`     | `Object`            | `{}`     | Environment config to take various settings from                                                                             |
| `init`    | `Boolean`           | `true`   | Use `env.SUPABASE_URL` + `env.SUPABASE_KEY` to login to Supabase, disable if some higher function handles this automatically |
| `login`   | `Boolean`           | `true`   | Use `env.SUPABASE_USER` + `env.SUPABASE_PASS` to login as that Supabase meta-user                                            |
| `session` | `'auto'` / `String` | `'auto'` | The supabase session to use, if 'auto' uses `env.SUPABASE_URL`                                                               |


supabasey.throw(err)
--------------------
Translate and throw a Supabase error object into a single JS Error object.

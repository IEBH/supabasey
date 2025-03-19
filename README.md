@iebh/supabasey
===============
Utility function to wrap the main Supabase worker function but with utility handling.

Unlike calling `supabase.FUNCTION` / `supabase.auth.FUNCTION` etc. this function takes a simple callback which then:

1. Flattens non-promise responses into then-ables
2. The query is forced to respond as a promise (prevents accidental query chaining)
3. The response data object is forced as a POJO return (if any data is returned, otherwise void)
4. Error responses throw with a logical error message rather than a weird object return
5. Retrying and back-off provided by default


API
===
This library exports a single function worker by default but also provides a few other utility function to make working with Supabase a little easier.

supabasey(callback, options)
----------------------------
The main worker function, accepts a function which is called as `(supabase:supabseClient)`.


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
Initialize Supabase, returning a Supabase session.

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

import { PostgrestError, AuthError, SupabaseClient } from '@supabase/supabase-js';
import { Options as PRetryOptions } from 'p-retry';
type SupabaseResponse<T> = {
    data: T | null;
    error: Error | PostgrestError | AuthError | null;
};
export type SupabaseyCallback<T = any> = (supabase: SupabaseClient) => PromiseLike<SupabaseResponse<T>>;
export interface SupabaseyOptions {
    session: string | SupabaseClient;
    retries?: number;
    retry?: PRetryOptions;
}
interface SupabaseyInitOptions {
    env?: Record<string, string | undefined>;
    init?: boolean;
    login?: boolean;
    session?: 'auto' | string;
}
interface SupabaseyMiddlewareOptions extends SupabaseyInitOptions {
    injectEnv?: boolean;
}
type ExtendedSupabaseClient = SupabaseClient & {
    supabaseyIsLoggedIn?: boolean;
};
type SupabaseySessions = Record<string, ExtendedSupabaseClient>;
export type BoundSupabaseyFunction = <T = any>(cb: SupabaseyCallback<T>, options?: Omit<SupabaseyOptions, 'session'>) => Promise<T>;
export interface SupabaseyCallable extends SupabaseyStatics {
    <T = any>(cb: SupabaseyCallback<T>, options: SupabaseyOptions): Promise<T>;
}
interface SupabaseyStatics {
    sessions: SupabaseySessions;
    bindSession: (session: string | SupabaseClient) => BoundSupabaseyFunction;
    init: (options?: SupabaseyInitOptions) => Promise<BoundSupabaseyFunction>;
    middleware: (options?: SupabaseyMiddlewareOptions) => (req: any, res: any, env: any, next?: any) => Promise<void>;
    rpc: <T = any>(method: string, args?: Record<string, any>, options?: SupabaseyOptions) => Promise<T>;
    throw: (err: any) => never;
}
export {};
//# sourceMappingURL=types.d.ts.map
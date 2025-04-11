import {
	PostgrestError,
	AuthError,
	SupabaseClient
} from '@supabase/supabase-js'
import { Options as PRetryOptions } from 'p-retry';

// Define a type for the Supabase response structure
type SupabaseResponse<T> = {
	data: T | null;
	error: PostgrestError | AuthError | null;
};

// Define the callback function type, using generics for the data type
export type SupabaseyCallback<T = any> = (
	supabase: SupabaseClient
) => Promise<SupabaseResponse<T>>;

// Define options for the main supabasey function
export interface SupabaseyOptions {
	session: string | SupabaseClient;
	retries?: number;
	retry?: PRetryOptions;
}

// Define options for the init function
interface SupabaseyInitOptions {
	env?: Record<string, string | undefined>;
	init?: boolean;
	login?: boolean;
	session?: 'auto' | string;
}

// Define options for the middleware function
interface SupabaseyMiddlewareOptions extends SupabaseyInitOptions {
	injectEnv?: boolean;
}

// Extend SupabaseClient type to include our custom property
// This avoids modifying the original type globally
type ExtendedSupabaseClient = SupabaseClient & {
	supabaseyIsLoggedIn?: boolean;
};

// Type for the sessions cache
type SupabaseySessions = Record<string, ExtendedSupabaseClient>;

// Type for the bound supabasey function returned by init/bindSession
export type BoundSupabaseyFunction = <T = any>(
	cb: SupabaseyCallback<T>,
	options?: Omit<SupabaseyOptions, 'session'> // Exclude session as it's pre-bound
) => Promise<T>; // Resolves with data directly, throws on error

// Interface describing the complete supabasey object (callable function + static properties)
export interface SupabaseyCallable extends SupabaseyStatics {
	// Call signature for the main function
	<T = any>(cb: SupabaseyCallback<T>, options: SupabaseyOptions): Promise<T>;
}

// Interface for the static properties (separated for clarity, optional)
interface SupabaseyStatics {
	sessions: SupabaseySessions;
	bindSession: (session: string | SupabaseClient) => BoundSupabaseyFunction;
	init: (options?: SupabaseyInitOptions) => Promise<BoundSupabaseyFunction>;
	middleware: (options?: SupabaseyMiddlewareOptions) =>
		(req: any, res: any, env: any, next?: any) => Promise<void>;
	rpc: <T = any>(
		method: string,
		args?: Record<string, any>,
		options?: SupabaseyOptions
	) => Promise<T>;
	throw: (err: any) => never;
}

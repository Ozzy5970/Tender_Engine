import { createClient } from '@supabase/supabase-js'
import { resilientStorage } from './auth/ResilientStorage'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // SAFETY: Use ResilientStorage to handle blocked localStorage (e.g. by extensions)
        storage: resilientStorage,
        // SAFETY: Disable "Navigator Lock" which is frequently broken by privacy extensions.
        // We rely on ResilientStorage and Server-Side validation instead of client locks.
        // @ts-expect-error - Supabase types are strict, but false is supported at runtime to disable locking.
        lock: false,
    }
})

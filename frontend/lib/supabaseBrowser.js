import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let browserClient = null;

export const getSupabaseBrowserClient = () => {
  if (browserClient) {
    return browserClient;
  }
  if (typeof window === 'undefined') {
    return null;
  }
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase credentials are missing. Auth is disabled.');
    return null;
  }

  browserClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'brewtoken-supabase-auth',
    },
  });

  return browserClient;
};

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let supabaseServerClient = null;

const requireUrl = () => {
  if (!supabaseUrl) {
    throw new Error('Supabase URL is missing. Set NEXT_PUBLIC_SUPABASE_URL.');
  }
};

export const getServerClient = () => {
  requireUrl();
  if (!supabaseAnonKey) {
    throw new Error('Supabase anon key is missing. Set NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  }
  if (!supabaseServerClient) {
    supabaseServerClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return supabaseServerClient;
};

export const getUserFromRequest = async (req) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    return null;
  }

  try {
    const client = getServerClient();
    const { data, error } = await client.auth.getUser(token);
    if (error) {
      console.error('Supabase getUser error:', error);
      return null;
    }
    return data?.user ?? null;
  } catch (error) {
    console.error('Supabase auth verification failed:', error);
    return null;
  }
};

export const createMerchantCredentials = async ({ email, password, displayName }) => {
  if (!email || !password) {
    throw new Error('Email and password are required.');
  }
  const client = getServerClient();
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      data: {
        displayName,
      },
    },
  });
  if (error) {
    throw error;
  }
  return data.user;
};


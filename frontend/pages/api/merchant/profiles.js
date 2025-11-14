import { createClient } from '@supabase/supabase-js';

// Note: This endpoint requires SUPABASE_SERVICE_ROLE_KEY for admin operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!supabaseUrl) {
    return res.status(500).json({ error: 'Supabase URL not configured', merchants: [] });
  }

  if (!supabaseServiceRoleKey) {
    return res.status(500).json({ error: 'Supabase service role key not configured. Set SUPABASE_SERVICE_ROLE_KEY in your environment variables.', merchants: [] });
  }

  try {
    // Create admin client with service role key
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Get all users from Supabase Auth
    const { data, error: listError } = await adminClient.auth.admin.listUsers();

    if (listError) {
      return res.status(500).json({ error: 'Failed to fetch merchant profiles', details: listError.message });
    }

    const users = data?.users || [];

    // Get login codes from merchant_login_codes table
    const { data: loginCodes, error: codesError } = await adminClient
      .from('merchant_login_codes')
      .select('user_id, login_code');

    // Create a map of user_id -> login_code
    const codesMap = new Map();
    if (!codesError && loginCodes) {
      loginCodes.forEach((record) => {
        codesMap.set(record.user_id, record.login_code);
      });
    }

    // Map users to merchant profiles
    // Login codes are now stored in merchant_login_codes table
    const merchantProfiles = users
      .filter((user) => user.email) // Only users with email
      .map((user) => ({
        id: user.id,
        email: user.email,
        name: user.user_metadata?.displayName || user.email?.split('@')[0] || 'Merchant',
        loginCode: codesMap.get(user.id) || null, // Get login code from merchant_login_codes table
        createdAt: user.created_at,
      }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // Sort by newest first

    return res.status(200).json({ merchants: merchantProfiles });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch merchant profiles' });
  }
}


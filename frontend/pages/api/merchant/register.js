import { createMerchantCredentials } from '../../../lib/supabaseServer';

const registrationSecret = process.env.MERCHANT_REGISTRATION_SECRET || '31337';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (registrationSecret) {
    const headerSecret = req.headers['x-api-key'];
    if (headerSecret !== registrationSecret) {
      return res.status(401).json({ error: 'Invalid registration secret.' });
    }
  }

  const { name, email, password, secret, loginCode } = req.body || {};

  if (!name || !email || !password || !secret || !loginCode) {
    return res.status(400).json({
      error: 'name, email, password, secret, and loginCode are required fields.',
    });
  }

  // Validate login code format
  if (typeof loginCode !== 'string' || loginCode.length !== 6 || !/^\d+$/.test(loginCode)) {
    return res.status(400).json({
      error: 'Login code must be exactly 6 digits.',
    });
  }

  if (secret !== registrationSecret) {
    return res.status(401).json({ error: 'Secret code is invalid.' });
  }

  try {
    const user = await createMerchantCredentials({
      email,
      password,
      displayName: name,
    });

    // Use the login code provided by the user
    // Update user metadata with login code (requires service role key)
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const { createClient } = require('@supabase/supabase-js');
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
        const adminClient = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        });

        // Update user metadata with display name
        await adminClient.auth.admin.updateUserById(user.id, {
          user_metadata: {
            displayName: name,
          },
        });

        // Store login code in merchant_login_codes table
        const { createClient: createSupabaseClient } = require('@supabase/supabase-js');
        const supabaseClient = createSupabaseClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY,
        );

        const { error: insertError } = await supabaseClient
          .from('merchant_login_codes')
          .upsert({
            user_id: user.id,
            email: email.toLowerCase(),
            login_code: loginCode.trim(),
          }, {
            onConflict: 'user_id',
          });

        if (insertError) {
          console.error('Failed to store login code:', insertError);
        } else {
          console.log(`[REG] User set login code for ${email}: ${loginCode.trim()}`);
        }
      } catch (updateError) {
        console.error('Failed to set login code during registration:', updateError);
        // Continue anyway - code can be set manually later
      }
    }

    return res.status(200).json({
      success: Boolean(user?.id),
      id: user?.id ?? null,
      email: user?.email ?? email,
    });
  } catch (error) {
    console.error('Merchant registration failed:', error);
    return res.status(500).json({ error: error?.message || 'Failed to register merchant account.' });
  }
}


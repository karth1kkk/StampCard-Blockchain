import { createClient } from '@supabase/supabase-js';

// In-memory store for temporary 6-digit codes (for sending via email)
// This is different from the permanent login codes stored in merchant_login_codes table
const codeStore = new Map();

// Clean up expired codes every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [email, data] of codeStore.entries()) {
      if (data.expiresAt < now) {
        codeStore.delete(email);
      }
    }
  }, 5 * 60 * 1000);
}

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { action, email, code } = req.body;

    if (action === 'send') {
      // Send temporary 6-digit code for this login session
      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      // Generate a temporary code for this login attempt
      const sixDigitCode = generateCode();
      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

      codeStore.set(email.toLowerCase(), {
        code: sixDigitCode,
        expiresAt,
        attempts: 0,
      });

      // In production, send email with code via Supabase or email service
      // TODO: Integrate with email service to send code
      // You can use Supabase Edge Functions or a service like SendGrid, Resend, etc.

      return res.status(200).json({
        success: true,
        message: 'Code sent to email',
        // Remove this in production:
        devCode: process.env.NODE_ENV === 'development' ? sixDigitCode : undefined,
      });
    }

    if (action === 'verify') {
      // Verify temporary 6-digit code
      if (!email || !code) {
        return res.status(400).json({ error: 'Email and code are required' });
      }

      // Check temporary code store first
      const stored = codeStore.get(email.toLowerCase());

      if (stored && stored.expiresAt >= Date.now() && stored.code === code) {
        // Temporary code verified - delete it
        codeStore.delete(email.toLowerCase());
        return res.status(200).json({
          success: true,
          email: email.toLowerCase(),
        });
      }

      // Check permanent login code from merchant_login_codes table
      if (supabaseUrl && supabaseServiceRoleKey) {
        try {
          // Create a Supabase client to query the merchant_login_codes table
          const dbClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
            auth: {
              autoRefreshToken: false,
              persistSession: false,
            },
          });

          // Query merchant_login_codes table for this email and code
          const { data: codeRecord, error: queryError } = await dbClient
            .from('merchant_login_codes')
            .select('user_id, email')
            .eq('email', email.toLowerCase())
            .eq('login_code', code)
            .single();

          if (!queryError && codeRecord) {
            // Code is correct! Get user details and create session
            const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
              auth: {
                autoRefreshToken: false,
                persistSession: false,
              },
            });

            // Get user info
            const { data: userData, error: userError } = await adminClient.auth.admin.getUserById(codeRecord.user_id);

            if (!userError && userData?.user) {
              // Code verified successfully - return user info for session creation
              return res.status(200).json({
                success: true,
                email: email.toLowerCase(),
                userId: codeRecord.user_id,
              });
            }
          }
        } catch (error) {
          // Error checking login code - will return invalid code error below
        }
      }

      // Invalid code
      if (stored) {
        stored.attempts += 1;
        if (stored.attempts >= 5) {
          codeStore.delete(email.toLowerCase());
          return res.status(400).json({ error: 'Too many attempts. Please request a new code.' });
        }
      }

      return res.status(400).json({ error: 'Invalid code. Please try again.' });
    }

    return res.status(400).json({ error: 'Invalid action' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

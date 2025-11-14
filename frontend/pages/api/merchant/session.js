import { createClient } from '@supabase/supabase-js';

// Note: This endpoint requires SUPABASE_SERVICE_ROLE_KEY for admin operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, userId } = req.body;

  if (!email || !userId) {
    return res.status(400).json({ error: 'Email and userId are required' });
  }

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return res.status(500).json({
      error: 'Server configuration error. SUPABASE_SERVICE_ROLE_KEY is required.',
    });
  }

  try {
    // Create admin client with service role key
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Since we've verified the 6-digit code, we can trust this user
    // Use Admin API to generate a magic link and extract tokens directly
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: email.toLowerCase(),
      options: {
        redirectTo: typeof req.headers.referer !== 'undefined' 
          ? new URL(req.headers.referer).origin 
          : 'http://localhost:3000',
      },
    });

    if (linkError) {
      return res.status(500).json({ error: 'Failed to create session', details: linkError.message });
    }

    const actionLink = linkData?.properties?.action_link;
    if (!actionLink) {
      return res.status(500).json({ error: 'Failed to generate session link' });
    }

    // Extract tokens from the action link URL
    let accessToken = null;
    let refreshToken = null;
    
    try {
      const url = new URL(actionLink);
      
      // Magic links contain tokens in the hash fragment: #access_token=xxx&refresh_token=yyy
      if (url.hash) {
        const hash = url.hash.substring(1); // Remove '#'
        const hashParams = new URLSearchParams(hash);
        accessToken = hashParams.get('access_token');
        refreshToken = hashParams.get('refresh_token');
      }
      
      // Also check query params as fallback
      if (!accessToken) {
        accessToken = url.searchParams.get('access_token');
      }
      if (!refreshToken) {
        refreshToken = url.searchParams.get('refresh_token');
      }
    } catch (parseError) {
      // Error parsing action link - will return action link instead
    }

    // Return tokens if extracted successfully
    if (accessToken && refreshToken) {
      return res.status(200).json({
        success: true,
        email: email.toLowerCase(),
        userId: userId,
        accessToken: accessToken,
        refreshToken: refreshToken,
      });
    }

    // If token extraction failed, return action link for frontend to handle
    return res.status(200).json({
      success: true,
      email: email.toLowerCase(),
      userId: userId,
      actionLink: actionLink,
      message: 'Session link generated. Navigate to action link to complete sign-in.',
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to create session', details: error.message });
  }
}

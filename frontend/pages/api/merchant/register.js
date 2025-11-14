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

  const { name, email, password, secret } = req.body || {};

  if (!name || !email || !password || !secret) {
    return res.status(400).json({
      error: 'name, email, password, and secret are required fields.',
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


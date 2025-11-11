import { createOutlet } from '../../../lib/db';

const registrationSecret = process.env.MERCHANT_REGISTRATION_SECRET;

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

  const {
    name,
    address,
    ownerAddress,
    merchantAddress,
    location,
    website,
    challengeUrl,
    signerPublicKey,
  } = req.body || {};

  if (!name || !ownerAddress || !merchantAddress || !challengeUrl) {
    return res.status(400).json({
      error: 'name, ownerAddress, merchantAddress, and challengeUrl are required fields.',
    });
  }

  try {
    const result = await createOutlet({
      name,
      address,
      ownerAddress,
      merchantAddress,
      location,
      website,
      challengeUrl,
      signerPublicKey,
    });

    return res.status(200).json({
      success: Boolean(result.lastInsertRowid),
      id: result.lastInsertRowid,
    });
  } catch (error) {
    console.error('Merchant registration failed:', error);
    return res.status(500).json({ error: error?.message || 'Failed to register merchant outlet.' });
  }
}


import { getOutlets, getOutlet, createOutlet } from '../../lib/db';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { id } = req.query;
    if (id) {
      const outlet = await getOutlet(parseInt(id));
      return res.status(200).json(outlet);
    }
    const outlets = await getOutlets();
    return res.status(200).json(outlets);
  }

  if (req.method === 'POST') {
    const {
      name,
      address,
      ownerAddress,
      merchantAddress,
      location,
      website,
      challengeUrl,
      signerPublicKey,
    } = req.body;

    if (!name || !ownerAddress) {
      return res.status(400).json({ error: 'name and ownerAddress are required' });
    }

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
    return res.status(200).json({ success: Boolean(result.lastInsertRowid), id: result.lastInsertRowid });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}


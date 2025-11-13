import { getPurchaseHistory, getRewardHistory } from '../../lib/db';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { address } = req.query;

    try {
      if (address) {
        const [purchases, rewards] = await Promise.all([
          getPurchaseHistory(address, 50),
          getRewardHistory(address, 25),
        ]);
        return res.status(200).json({ purchases, rewards });
      }

      const purchases = await getPurchaseHistory(null, 100);
      return res.status(200).json({ purchases });
    } catch (error) {
      console.error('Transactions API error:', error);
      return res.status(500).json({ error: error?.message || 'Unable to load transactions' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}


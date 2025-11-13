import { getCustomerSummary, listCustomers } from '../../lib/db';
import { getUserFromRequest } from '../../lib/supabaseServer';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const normaliseQuery = (value) => (Array.isArray(value) ? value[0] : value);
    const address = normaliseQuery(req.query.address);
    const scope = normaliseQuery(req.query.scope);

    try {
      if (scope === 'all') {
        const user = await getUserFromRequest(req);
        if (!user) {
          return res.status(401).json({ error: 'Not authenticated' });
        }
        const customers = await listCustomers();
        return res.status(200).json({ customers });
      }

      if (!address) {
        return res.status(400).json({ error: 'Address query parameter is required' });
      }

      const summary = await getCustomerSummary(address);
      return res.status(200).json(summary);
    } catch (error) {
      console.error('Customers API error:', error);
      return res.status(500).json({ error: error?.message || 'Unable to load customer data' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}


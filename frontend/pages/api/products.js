import { listProducts } from '../../lib/db';
import { getUserFromRequest } from '../../lib/supabaseServer';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      // Products can be fetched by anyone (no auth required for menu display)
      // But if you want to restrict it, uncomment the auth check below
      // const user = await getUserFromRequest(req);
      // if (!user) {
      //   return res.status(401).json({ error: 'Not authenticated' });
      // }
      
      const products = await listProducts();
      return res.status(200).json({ products });
    } catch (error) {
      console.error('Products API error:', error);
      return res.status(500).json({ error: error?.message || 'Unable to load products' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}


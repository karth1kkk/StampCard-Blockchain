import { getCustomer, createCustomer, updateCustomer } from '../../lib/db';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { address } = req.query;
    if (!address) {
      return res.status(400).json({ error: 'Address is required' });
    }
    const customer = await getCustomer(address);
    return res.status(200).json(customer || { address });
  }

  if (req.method === 'POST') {
    const { address, name, email, phone } = req.body;
    if (!address) {
      return res.status(400).json({ error: 'Address is required' });
    }
    await createCustomer(address, name, email, phone);
    return res.status(200).json({ success: true });
  }

  if (req.method === 'PUT') {
    const { address, name, email, phone } = req.body;
    if (!address) {
      return res.status(400).json({ error: 'Address is required' });
    }
    await updateCustomer(address, name, email, phone);
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}


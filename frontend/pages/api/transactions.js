import { saveTransaction, getCustomerTransactions, getAllTransactions } from '../../lib/db';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { address } = req.query;
    if (address) {
      const transactions = await getCustomerTransactions(address);
      return res.status(200).json(transactions);
    }
    const transactions = await getAllTransactions();
    return res.status(200).json(transactions);
  }

  if (req.method === 'POST') {
    const { customerAddress, transactionHash, transactionType, blockNumber } = req.body;
    if (!customerAddress || !transactionHash || !transactionType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    await saveTransaction(customerAddress, transactionHash, transactionType, blockNumber);
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}


import { recordPurchase, recordRewardRedemption, getCustomerSummary } from '../../lib/db';
import { getUserFromRequest } from '../../lib/supabaseServer';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const {
      address,
      email,
      items,
      totalBWT,
      txHash,
      blockNumber,
      status,
      merchantEmail,
      rewardThreshold,
      stampsAwarded,
      pendingRewards,
      stampCount,
      metadata,
    } = req.body || {};

    if (!address || !txHash) {
      return res.status(400).json({ error: 'address and txHash are required' });
    }

    try {
      const summary = await recordPurchase({
        walletAddress: address,
        email,
        items,
        totalBWT,
        txHash,
        blockNumber,
        status,
        merchantEmail,
        rewardThreshold,
        stampsAwarded,
        pendingRewards,
        stampCount,
        metadata,
      });
      return res.status(200).json(summary);
    } catch (error) {
      console.error('Purchase sync error:', error);
      return res.status(500).json({ error: error?.message || 'Unable to record purchase' });
    }
  }

  if (req.method === 'PATCH') {
    const { address, txHash, blockNumber, rewardAmountBWT, stampCount, pendingRewards } = req.body || {};
    if (!address) {
      return res.status(400).json({ error: 'address is required' });
    }
    try {
      const user = await getUserFromRequest(req);
      if (!user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      const result = await recordRewardRedemption({
        walletAddress: address,
        txHash,
        blockNumber,
        rewardAmountBWT,
        stampCount: stampCount !== undefined ? Number(stampCount) : undefined,
        pendingRewards: pendingRewards !== undefined ? Number(pendingRewards) : undefined,
      });
      return res.status(200).json(result);
    } catch (error) {
      console.error('Reward redemption sync error:', error);
      return res.status(500).json({ error: error?.message || 'Unable to record reward redemption' });
    }
  }

  if (req.method === 'GET') {
    const { address } = req.query;
    if (!address) {
      return res.status(400).json({ error: 'address query parameter is required' });
    }

    try {
      const summary = await getCustomerSummary(address);
      return res.status(200).json(summary);
    } catch (error) {
      console.error('Stamp summary error:', error);
      return res.status(500).json({ error: error?.message || 'Unable to load stamp data' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}


import { ethers } from 'ethers';
import { recordPurchase, recordRewardRedemption, getCustomerSummary } from '../../lib/db';
import { COFFEE_LOYALTY_ABI } from '../../lib/contractABI';

const LOYALTY_ADDRESS = process.env.NEXT_PUBLIC_LOYALTY_ADDRESS;
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545';
const MERCHANT_MESSAGE = process.env.MERCHANT_ACCESS_MESSAGE || 'CoffeeLoyaltyMerchantAccess';

let provider;
if (LOYALTY_ADDRESS) {
  provider = new ethers.JsonRpcProvider(RPC_URL);
}

const verifyOwner = async (ownerAddress, signature) => {
  if (!provider || !LOYALTY_ADDRESS) {
    throw new Error('CoffeeLoyalty contract not configured on the backend');
  }
  const contract = new ethers.Contract(LOYALTY_ADDRESS, COFFEE_LOYALTY_ABI, provider);
  const contractOwner = await contract.owner();
  if (contractOwner.toLowerCase() !== ownerAddress.toLowerCase()) {
    return false;
  }
  if (!signature) {
    return false;
  }
  const message = `${MERCHANT_MESSAGE}:${ownerAddress.toLowerCase()}`;
  try {
    const recovered = ethers.verifyMessage(message, signature);
    return recovered.toLowerCase() === ownerAddress.toLowerCase();
  } catch (error) {
    console.error('Failed to verify merchant signature', error);
    return false;
  }
};

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const {
      address,
      productId,
      productName,
      priceBWT,
      txHash,
      blockNumber,
      outletId,
      metadata,
      rewardThreshold,
      stampsAwarded,
    } = req.body || {};

    if (!address || !txHash || !priceBWT) {
      return res.status(400).json({ error: 'address, priceBWT, and txHash are required' });
    }

    try {
      const summary = await recordPurchase({
        walletAddress: address,
        productId,
        productName,
        priceBWT,
        txHash,
        blockNumber,
        outletId,
        metadata,
        rewardThreshold,
        stampsAwarded,
      });
      return res.status(200).json(summary);
    } catch (error) {
      console.error('Purchase sync error:', error);
      return res.status(500).json({ error: error?.message || 'Unable to record purchase' });
    }
  }

  if (req.method === 'PATCH') {
    const { address, txHash, blockNumber, rewardAmountBWT, owner, signature } = req.body || {};
    if (!address) {
      return res.status(400).json({ error: 'address is required' });
    }
    try {
      const authorised = await verifyOwner(owner || '', signature || '');
      if (!authorised) {
        return res.status(401).json({ error: 'Invalid owner signature' });
      }
      const result = await recordRewardRedemption({
        walletAddress: address,
        txHash,
        blockNumber,
        rewardAmountBWT,
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

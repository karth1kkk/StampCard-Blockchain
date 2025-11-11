import { ethers } from 'ethers';
import { STAMPCARD_ABI } from '../../../lib/contractABI';

const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || process.env.RPC_URL || 'http://127.0.0.1:8545';
const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
const merchantPrivateKey = process.env.MERCHANT_SIGNER_PRIVATE_KEY;

const provider = new ethers.JsonRpcProvider(rpcUrl);
const contract = contractAddress ? new ethers.Contract(contractAddress, STAMPCARD_ABI, provider) : null;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!contractAddress || !contract) {
    return res.status(500).json({ error: 'Contract address is not configured on the server.' });
  }

  if (!merchantPrivateKey) {
    return res
      .status(500)
      .json({ error: 'Merchant signer key not configured. Set MERCHANT_SIGNER_PRIVATE_KEY.' });
  }

  const { customer, outletId, merchant } = req.query;

  if (!customer || !ethers.isAddress(customer)) {
    return res.status(400).json({ error: 'customer query param must be a valid address.' });
  }

  if (!outletId || Number.isNaN(parseInt(outletId, 10))) {
    return res.status(400).json({ error: 'outletId query param must be a number.' });
  }

  if (!merchant || !ethers.isAddress(merchant)) {
    return res.status(400).json({ error: 'merchant query param must be a valid address.' });
  }

  try {
    const chain = await provider.getNetwork();
    const nonce = await contract.getCustomerNonce(customer);
    const wallet = new ethers.Wallet(merchantPrivateKey, provider);

    if (wallet.address.toLowerCase() !== merchant.toLowerCase()) {
      return res.status(401).json({ error: 'Merchant signer mismatch for this QR payload.' });
    }

    const authorized = await contract.isMerchantAuthorized(wallet.address);
    if (!authorized) {
      return res.status(403).json({ error: 'Merchant is not authorized to issue stamps.' });
    }

    const messageHash = ethers.solidityPackedKeccak256(
      ['address', 'uint256', 'uint256', 'address', 'uint256'],
      [customer, Number(outletId), nonce, contractAddress, chain.chainId]
    );

    const signature = await wallet.signMessage(ethers.getBytes(messageHash));
    const payload = ethers.AbiCoder.defaultAbiCoder().encode(['bytes', 'uint256'], [signature, nonce]);

    return res.status(200).json({
      signature: payload,
      nonce: Number(nonce),
      outletId: Number(outletId),
      merchant: wallet.address,
      chainId: Number(chain.chainId),
    });
  } catch (error) {
    console.error('Merchant challenge error:', error);
    return res.status(500).json({ error: error?.message || 'Unable to create merchant challenge.' });
  }
}


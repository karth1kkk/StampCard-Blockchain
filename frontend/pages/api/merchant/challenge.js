import { ethers } from 'ethers';
import { STAMPCARD_ABI } from '../../../lib/contractABI';

const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || process.env.RPC_URL || 'http://127.0.0.1:8545';
const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
const merchantPrivateKey = process.env.MERCHANT_SIGNER_PRIVATE_KEY;

const provider = new ethers.JsonRpcProvider(rpcUrl);
const contract = contractAddress ? new ethers.Contract(contractAddress, STAMPCARD_ABI, provider) : null;

export default function handler(req, res) {
  res.status(410).json({
    error: 'This endpoint is no longer used. BrewToken loyalty stamps are issued automatically after purchase.',
  });
}


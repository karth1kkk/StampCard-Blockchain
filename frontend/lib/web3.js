import { ethers } from 'ethers';
import { STAMPCARD_ABI } from './contractABI';

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;

export const getContract = (signerOrProvider) => {
  if (!CONTRACT_ADDRESS) {
    throw new Error('Contract address is not configured. Set NEXT_PUBLIC_CONTRACT_ADDRESS in .env.local.');
  }
  return new ethers.Contract(CONTRACT_ADDRESS, STAMPCARD_ABI, signerOrProvider);
};

export const getContractReadOnly = (provider) => getContract(provider);

export const checkContractDeployed = async (provider) => {
  try {
    const address = CONTRACT_ADDRESS;
    if (!address) {
      return false;
    }
    const code = await provider.getCode(address);
    return code && code !== '0x';
  } catch (error) {
    console.error('Error checking contract deployment:', error);
    return false;
  }
};

export const getStampCount = async (address, provider) => {
  if (!address || !provider) return 0;
  try {
    const contract = getContractReadOnly(provider);
    const count = await contract.getStampCount(address);
    return Number(count);
  } catch (error) {
    handleContractError(error, 'getStampCount');
    return 0;
  }
};

export const getRewardCount = async (address, provider) => {
  if (!address || !provider) return 0;
  try {
    const contract = getContractReadOnly(provider);
    const count = await contract.getRewardCount(address);
    return Number(count);
  } catch (error) {
    handleContractError(error, 'getRewardCount');
    return 0;
  }
};

export const getRewardThreshold = async (provider) => {
  if (!provider) return 0;
  try {
    const contract = getContractReadOnly(provider);
    const threshold = await contract.rewardThreshold();
    return Number(threshold);
  } catch (error) {
    handleContractError(error, 'getRewardThreshold');
    return 0;
  }
};

export const getCustomerNonce = async (address, provider) => {
  if (!address || !provider) return 0;
  try {
    const contract = getContractReadOnly(provider);
    const nonce = await contract.getCustomerNonce(address);
    return Number(nonce);
  } catch (error) {
    handleContractError(error, 'getCustomerNonce');
    return 0;
  }
};

export const isOwner = async (address, provider) => {
  if (!address || !provider) return false;
  try {
    const contract = getContractReadOnly(provider);
    const owner = await contract.owner();
    return owner.toLowerCase() === address.toLowerCase();
  } catch (error) {
    console.error('Error determining owner:', error);
    return false;
  }
};

export const issueStamp = async ({ customerAddress, outletId, signaturePayload }, signer) => {
  if (!signer) {
    throw new Error('Wallet signer is not available.');
  }
  const contract = getContract(signer);
  const tx = await contract.issueStamp(customerAddress, outletId, signaturePayload);
  const receipt = await tx.wait();
  return { hash: tx.hash, receipt };
};

export const redeemReward = async (customerAddress, signer) => {
  if (!signer) {
    throw new Error('Wallet signer is not available.');
  }
  const contract = getContract(signer);
  const tx = await contract.redeemReward(customerAddress);
  const receipt = await tx.wait();
  return { hash: tx.hash, receipt };
};

export const getTransactionHistory = async (address, provider, fromBlock = 0) => {
  const contract = getContractReadOnly(provider);
  const history = [];

  try {
    const stampIssuedFilter = contract.filters.StampIssued(address);
    const rewardGrantedFilter = contract.filters.RewardGranted(address);
    const rewardRedeemedFilter = contract.filters.RewardRedeemed(address);

    const [stampsIssued, rewardsGranted, rewardsRedeemed] = await Promise.all([
      contract.queryFilter(stampIssuedFilter, fromBlock),
      contract.queryFilter(rewardGrantedFilter, fromBlock),
      contract.queryFilter(rewardRedeemedFilter, fromBlock),
    ]);

    stampsIssued.forEach((event) => {
      history.push({
        type: 'stamp_issued',
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
        outletId: Number(event.args.outletId),
        totalStamps: Number(event.args.totalStamps),
        timestamp: event.blockTimestamp ? new Date(Number(event.blockTimestamp) * 1000) : new Date(),
      });
    });

    rewardsGranted.forEach((event) => {
      history.push({
        type: 'reward_granted',
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
        rewardCount: Number(event.args.rewardCount),
        timestamp: event.blockTimestamp ? new Date(Number(event.blockTimestamp) * 1000) : new Date(),
      });
    });

    rewardsRedeemed.forEach((event) => {
      history.push({
        type: 'reward_redeemed',
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
        remainingRewards: Number(event.args.remainingRewards),
        timestamp: event.blockTimestamp ? new Date(Number(event.blockTimestamp) * 1000) : new Date(),
      });
    });

    history.sort((a, b) => b.blockNumber - a.blockNumber);
    return history;
  } catch (error) {
    console.error('Error getting transaction history:', error);
    return [];
  }
};

const handleContractError = (error, action) => {
  if (error.code === 'BAD_DATA' || error.code === 'CALL_EXCEPTION') {
    console.error(`Contract call failed for ${action}. Check address, ABI, or network.`);
  } else {
    console.error(`Error during ${action}:`, error);
  }
};


import { ethers } from 'ethers';
import { COFFEE_LOYALTY_ABI, BREW_TOKEN_ABI } from './contractABI';

const LOYALTY_ADDRESS = process.env.NEXT_PUBLIC_LOYALTY_ADDRESS;
const TOKEN_ADDRESS = process.env.NEXT_PUBLIC_TOKEN_ADDRESS;

const requireAddress = (address, name) => {
  if (!address) {
    throw new Error(`${name} is not configured. Update your .env.local file.`);
  }
  return address;
};

export const getLoyaltyContract = (signerOrProvider) => {
  const address = requireAddress(LOYALTY_ADDRESS, 'NEXT_PUBLIC_LOYALTY_ADDRESS');
  return new ethers.Contract(address, COFFEE_LOYALTY_ABI, signerOrProvider);
};

export const getTokenContract = (signerOrProvider) => {
  const address = requireAddress(TOKEN_ADDRESS, 'NEXT_PUBLIC_TOKEN_ADDRESS');
  return new ethers.Contract(address, BREW_TOKEN_ABI, signerOrProvider);
};

export const getContractReadOnly = (provider) => getLoyaltyContract(provider);

export const checkContractDeployed = async (provider) => {
  try {
    const address = LOYALTY_ADDRESS;
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

export const getContractOwner = async (provider) => {
  if (!provider) return null;
  try {
    const contract = getContractReadOnly(provider);
    return await contract.owner();
  } catch (error) {
    console.error('Failed to fetch contract owner:', error);
    return null;
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

export const getPendingRewards = async (address, provider) => {
  if (!address || !provider) return 0;
  try {
    const contract = getContractReadOnly(provider);
    const count = await contract.getPendingRewards(address);
    return Number(count);
  } catch (error) {
    handleContractError(error, 'getPendingRewards');
    return 0;
  }
};

export const getTotalVolume = async (address, provider) => {
  if (!address || !provider) return 0n;
  try {
    const contract = getContractReadOnly(provider);
    return await contract.getTotalVolume(address);
  } catch (error) {
    handleContractError(error, 'getTotalVolume');
    return 0n;
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

export const getRewardTokenAmount = async (provider) => {
  if (!provider) return 0n;
  try {
    const contract = getContractReadOnly(provider);
    return await contract.rewardTokenAmount();
  } catch (error) {
    handleContractError(error, 'getRewardTokenAmount');
    return 0n;
  }
};

export const getTokenBalance = async (address, provider) => {
  if (!address || !provider) return 0n;
  try {
    const token = getTokenContract(provider);
    return await token.balanceOf(address);
  } catch (error) {
    console.error('Failed to fetch token balance:', error);
    return 0n;
  }
};

export const getTokenAllowance = async (ownerAddress, spender, provider) => {
  if (!ownerAddress || !spender || !provider) return 0n;
  try {
    const token = getTokenContract(provider);
    return await token.allowance(ownerAddress, spender);
  } catch (error) {
    console.error('Failed to fetch allowance:', error);
    return 0n;
  }
};

export const approveTokenSpending = async (spender, amount, signer) => {
  if (!signer) {
    throw new Error('Wallet signer is not available.');
  }
  if (!spender) {
    throw new Error('Spender address is required.');
  }
  const token = getTokenContract(signer);
  const tx = await token.approve(spender, amount);
  const receipt = await tx.wait();
  return { hash: tx.hash, receipt };
};

export const buyCoffee = async ({ customerAddress, priceWei }, signer) => {
  if (!signer) {
    throw new Error('Wallet signer is not available.');
  }
  const contract = getLoyaltyContract(signer);
  const tx = await contract.buyCoffee(customerAddress, priceWei);
  const receipt = await tx.wait();
  return { hash: tx.hash, receipt };
};

export const redeemRewardOnChain = async (customerAddress, signer) => {
  if (!signer) {
    throw new Error('Wallet signer is not available.');
  }
  const contract = getLoyaltyContract(signer);
  const tx = await contract.redeemReward(customerAddress);
  const receipt = await tx.wait();
  return { hash: tx.hash, receipt };
};

export const fundRewardsOnChain = async (amountWei, signer) => {
  if (!signer) {
    throw new Error('Wallet signer is not available.');
  }
  const contract = getLoyaltyContract(signer);
  const tx = await contract.fundRewards(amountWei);
  const receipt = await tx.wait();
  return { hash: tx.hash, receipt };
};

export const withdrawRewardsOnChain = async (to, amountWei, signer) => {
  if (!signer) {
    throw new Error('Wallet signer is not available.');
  }
  const contract = getLoyaltyContract(signer);
  const tx = await contract.withdrawRewards(to, amountWei);
  const receipt = await tx.wait();
  return { hash: tx.hash, receipt };
};

export const getEventHistory = async (address, provider, fromBlock = 0) => {
  const contract = getContractReadOnly(provider);
  const history = [];

  try {
    const purchasesFilter = contract.filters.CoffeePurchased(address);
    const rewardEarnedFilter = contract.filters.RewardEarned(address);
    const rewardRedeemedFilter = contract.filters.RewardRedeemed(address);

    const [purchases, rewardsEarned, rewardsRedeemed] = await Promise.all([
      contract.queryFilter(purchasesFilter, fromBlock),
      contract.queryFilter(rewardEarnedFilter, fromBlock),
      contract.queryFilter(rewardRedeemedFilter, fromBlock),
    ]);

    purchases.forEach((event) => {
      history.push({
        type: 'purchase',
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
        price: event.args.priceInTokens,
        timestamp: event.blockTimestamp ? Number(event.blockTimestamp) * 1000 : undefined,
      });
    });

    rewardsEarned.forEach((event) => {
      history.push({
        type: 'reward_earned',
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
        pendingRewards: Number(event.args.totalPendingRewards),
        timestamp: event.blockTimestamp ? Number(event.blockTimestamp) * 1000 : undefined,
      });
    });

    rewardsRedeemed.forEach((event) => {
      history.push({
        type: 'reward_redeemed',
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
        remainingRewards: Number(event.args.remainingRewards),
        payoutAmount: event.args.payoutAmount,
        timestamp: event.blockTimestamp ? Number(event.blockTimestamp) * 1000 : undefined,
      });
    });

    history.sort((a, b) => b.blockNumber - a.blockNumber);
    return history;
  } catch (error) {
    console.error('Error getting event history:', error);
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


import { useState, useEffect, useMemo, useCallback } from 'react';
import { ethers } from 'ethers';
import { toast } from 'react-toastify';
import { useWallet } from '../context/WalletContext';
import {
  redeemRewardOnChain,
  fundRewardsOnChain,
  getTokenBalance,
  getRewardTokenAmount,
} from '../lib/web3';
import ConnectViaQR from './ConnectViaQR';
import { BREW_TOKEN_SYMBOL } from '../lib/constants';

const formatBWT = (value) => {
  try {
    return Number(ethers.formatUnits(value, 18)).toFixed(2);
  } catch (error) {
    return '0.00';
  }
};

const ACCESS_MESSAGE = process.env.MERCHANT_ACCESS_MESSAGE || 'CoffeeLoyaltyMerchantAccess';
const LOYALTY_ADDRESS = process.env.NEXT_PUBLIC_LOYALTY_ADDRESS;

export default function MerchantDashboard() {
  const {
    customerAddress,
    customerSigner,
    provider,
    isOwner,
    isOwnerLoading,
    isCorrectNetwork,
    ensureCorrectNetwork,
  } = useWallet();

  const [customers, setCustomers] = useState([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [ownerSignature, setOwnerSignature] = useState(null);
  const [rewardPoolBalance, setRewardPoolBalance] = useState(0n);
  const [rewardTokenAmount, setRewardTokenAmount] = useState(0n);
  const [isFunding, setIsFunding] = useState(false);

  const totals = useMemo(() => {
    const stampTotal = customers.reduce((acc, customer) => acc + (customer.stamp_count || 0), 0);
    const pendingRewards = customers.reduce((acc, customer) => acc + (customer.pending_rewards || 0), 0);
    const totalVolume = customers.reduce(
      (acc, customer) => acc + Number(customer.total_volume || 0),
      0
    );
    return {
      stampTotal,
      pendingRewards,
      totalVolume,
      customerCount: customers.length,
    };
  }, [customers]);

  const signOwnerMessage = useCallback(async () => {
    if (!customerSigner || !customerAddress) {
      throw new Error('Connect the contract owner wallet to continue.');
    }
    const message = `${ACCESS_MESSAGE}:${customerAddress.toLowerCase()}`;
    const signature = await customerSigner.signMessage(message);
    setOwnerSignature(signature);
    return signature;
  }, [customerSigner, customerAddress]);

  const fetchCustomers = useCallback(async () => {
    if (!customerAddress || !customerSigner) {
      return;
    }
    if (!isOwner) {
      toast.error('Connect the contract owner wallet to load customer data.');
      return;
    }
    if (!isCorrectNetwork) {
      try {
        await ensureCorrectNetwork();
      } catch (error) {
        toast.error(error?.message || 'Network switch rejected.');
      return;
      }
    }

    try {
      setLoadingCustomers(true);
      const signature = ownerSignature || (await signOwnerMessage());
      const params = new URLSearchParams({
        scope: 'all',
        owner: customerAddress,
        signature,
      });
      const response = await fetch(`/api/customers?${params.toString()}`);
      if (!response.ok) {
        throw new Error((await response.json())?.error || 'Unable to load customers');
      }
      const payload = await response.json();
      setCustomers(payload.customers || []);
    } catch (error) {
      console.error('Failed to load customers:', error);
      toast.error(error?.message || 'Unable to load customers');
    } finally {
      setLoadingCustomers(false);
    }
  }, [customerAddress, customerSigner, isOwner, isCorrectNetwork, ensureCorrectNetwork, ownerSignature, signOwnerMessage]);

  const refreshRewardPool = useCallback(async () => {
    if (!provider) {
      return;
    }
    try {
      const [poolBalance, rewardAmount] = await Promise.all([
        LOYALTY_ADDRESS ? getTokenBalance(LOYALTY_ADDRESS, provider) : Promise.resolve(0n),
        getRewardTokenAmount(provider),
      ]);
      setRewardPoolBalance(poolBalance);
      setRewardTokenAmount(rewardAmount);
    } catch (error) {
      console.error('Failed to load reward pool info:', error);
    }
  }, [provider]);

  useEffect(() => {
    refreshRewardPool();
  }, [refreshRewardPool]);

  useEffect(() => {
    if (isOwner && customerAddress) {
      fetchCustomers();
    }
  }, [isOwner, customerAddress, fetchCustomers]);

  const handleRedeemReward = async (walletAddress) => {
    if (!customerSigner || !customerAddress) {
      toast.error('Connect the owner wallet first.');
      return;
    }
    try {
      if (!isCorrectNetwork) {
        await ensureCorrectNetwork();
      }
      const { hash, receipt } = await redeemRewardOnChain(walletAddress, customerSigner);
      toast.success(`Reward redeemed for ${walletAddress.slice(0, 6)}… — tx: ${hash.slice(0, 10)}…`);
      const signature = ownerSignature || (await signOwnerMessage());
      await fetch('/api/stamps', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: walletAddress,
          txHash: hash,
          blockNumber: receipt?.blockNumber || null,
          rewardAmountBWT: Number(ethers.formatUnits(rewardTokenAmount, 18)),
          owner: customerAddress,
          signature,
        }),
      }).catch((error) => console.error('Failed to sync reward redemption', error));
      await Promise.all([fetchCustomers(), refreshRewardPool()]);
    } catch (error) {
      console.error('Reward redemption failed:', error);
      toast.error(error?.shortMessage || error?.message || 'Reward redemption failed');
    }
  };

  const handleFundRewards = async () => {
    if (!customerSigner) {
      toast.error('Connect the owner wallet first.');
      return;
    }
    const amount = prompt('Enter amount of BWT to add to the reward pool:', '100');
    if (!amount) return;
    try {
      if (!isCorrectNetwork) {
        await ensureCorrectNetwork();
      }
      setIsFunding(true);
      const amountWei = ethers.parseUnits(amount, 18);
      const { hash } = await fundRewardsOnChain(amountWei, customerSigner);
      toast.success(`Reward pool funded. Tx: ${hash.slice(0, 10)}…`);
      await refreshRewardPool();
    } catch (error) {
      console.error('Funding reward pool failed:', error);
      toast.error(error?.shortMessage || error?.message || 'Funding failed');
    } finally {
      setIsFunding(false);
    }
  };

  if (isOwnerLoading) {
    return (
      <div className="py-12 text-center text-slate-300">Checking owner permissions…</div>
    );
  }

  if (!isOwner) {
    return (
      <div className="py-12 text-center text-slate-300">
        Connect the wallet that deployed the CoffeeLoyalty contract to manage the merchant dashboard.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-emerald-200">Owner Portal</p>
          <h2 className="text-3xl font-semibold text-white sm:text-4xl">Merchant Operations Console</h2>
          <p className="mt-2 text-sm text-slate-300">
            Review loyalty performance, redeem free drinks for customers, and generate QR codes for easy mobile
            checkout.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
        <button
            onClick={fetchCustomers}
            disabled={loadingCustomers}
            className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/80 transition hover:border-white/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingCustomers ? 'Refreshing…' : 'Refresh Customers'}
                </button>
                <button
            onClick={handleFundRewards}
            disabled={isFunding}
            className="rounded-full border border-emerald-400/30 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-200 transition hover:border-emerald-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isFunding ? 'Funding…' : 'Fund Reward Pool'}
                </button>
              </div>
      </header>

      <section className="grid gap-6 md:grid-cols-3">
        <div className="rounded-3xl border border-emerald-400/40 bg-emerald-400/10 p-6 shadow-xl shadow-emerald-900/40 backdrop-blur-2xl">
          <h3 className="text-xl font-semibold text-white">Customers</h3>
          <p className="mt-3 text-4xl font-bold text-emerald-100">{totals.customerCount}</p>
          <p className="mt-3 text-sm text-emerald-100/80">Active wallets participating in the loyalty programme.</p>
            </div>
        <div className="rounded-3xl border border-purple-500/40 bg-purple-500/10 p-6 shadow-xl shadow-purple-900/40 backdrop-blur-2xl">
          <h3 className="text-xl font-semibold text-white">Pending Rewards</h3>
          <p className="mt-3 text-4xl font-bold text-purple-100">{totals.pendingRewards}</p>
          <p className="mt-3 text-sm text-purple-100/80">Free drinks awaiting redemption.</p>
        </div>
        <div className="rounded-3xl border border-blue-500/40 bg-blue-500/10 p-6 shadow-xl shadow-blue-900/40 backdrop-blur-2xl">
          <h3 className="text-xl font-semibold text-white">Contract Balance</h3>
          <p className="mt-3 text-3xl font-bold text-blue-100">
            {formatBWT(rewardPoolBalance)} {BREW_TOKEN_SYMBOL}
          </p>
          <p className="mt-2 text-xs text-blue-100/80">
            BrewToken currently held by CoffeeLoyalty. Reward size: {formatBWT(rewardTokenAmount)} {BREW_TOKEN_SYMBOL}{' '}
            per redemption.
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl shadow-indigo-900/30 backdrop-blur-2xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-white/50">Customer Loyalty</p>
            <h3 className="text-2xl font-semibold text-white">Reward Management</h3>
            <p className="mt-2 text-sm text-slate-300">
              Redeem free drinks when customers reach {formatNumberWithCommas(rewardTokenAmount ? Number(ethers.formatUnits(rewardTokenAmount, 18)) : 0)} {BREW_TOKEN_SYMBOL}{' '}
              payout or manually top up the reward pool as needed.
            </p>
          </div>
        </div>

        {customers.length === 0 ? (
          <p className="mt-6 text-sm text-slate-300">
            {loadingCustomers ? 'Loading customers…' : 'No customer activity yet.'}
          </p>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-sm text-slate-200">
              <caption className="pb-4 text-left text-xs uppercase tracking-[0.3em] text-white/40">
                Contract balance: {formatBWT(rewardPoolBalance)} {BREW_TOKEN_SYMBOL} · Customers tracked: {customers.length}
              </caption>
              <thead>
                <tr className="text-left text-xs uppercase tracking-[0.3em] text-white/50">
                  <th className="px-4 py-2">Customer</th>
                  <th className="px-4 py-2">Stamps</th>
                  <th className="px-4 py-2">Pending Rewards</th>
                  <th className="px-4 py-2">Total Volume (BWT)</th>
                  <th className="px-4 py-2">Last Purchase</th>
                  <th className="px-4 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {customers.map((customer) => (
                  <tr key={customer.wallet_address}>
                    <td className="px-4 py-3 font-mono text-xs text-slate-100">
                      {customer.wallet_address.slice(0, 10)}…{customer.wallet_address.slice(-6)}
                    </td>
                    <td className="px-4 py-3">{customer.stamp_count}</td>
                    <td className="px-4 py-3">{customer.pending_rewards}</td>
                    <td className="px-4 py-3">{Number(customer.total_volume || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {customer.last_purchase_at ? new Date(customer.last_purchase_at).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                <button
                        onClick={() => handleRedeemReward(customer.wallet_address)}
                        disabled={customer.pending_rewards <= 0 || isFunding || loadingCustomers}
                        className="rounded-full border border-emerald-400/40 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-100 transition hover:border-emerald-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Redeem Reward
                </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConnectViaQR />
    </div>
  );
}

function formatNumberWithCommas(value) {
  const number = Number(value || 0);
  if (Number.isNaN(number)) {
    return '0';
  }
  return number.toLocaleString();
}


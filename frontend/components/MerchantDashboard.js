import { useState, useEffect, useMemo, useCallback } from 'react';
import { ethers } from 'ethers';
import { toast } from 'react-toastify';
import { useWallet } from '../context/WalletContext';
import {
  redeemRewardOnChain,
  fundRewardsOnChain,
  getTokenBalance,
  getRewardTokenAmount,
  transferTokensOnChain,
} from '../lib/web3';
import ConnectViaQR from './ConnectViaQR';
import { BREW_TOKEN_SYMBOL, MERCHANT_WALLET_ADDRESS, LOYALTY_CONTRACT_ADDRESS } from '../lib/constants';

const formatBWT = (value) => {
  try {
    return Number(ethers.formatUnits(value, 18)).toFixed(2);
  } catch (error) {
    return '0.00';
  }
};

const shortenAddress = (value) =>
  value ? `${value.slice(0, 6)}…${value.slice(-4)}` : '—';

const LOYALTY_ADDRESS = process.env.NEXT_PUBLIC_LOYALTY_ADDRESS;

export default function MerchantDashboard({ session }) {
  const {
    customerAddress,
    customerSigner,
    provider,
    isCorrectNetwork,
    ensureCorrectNetwork,
    isOwner,
  } = useWallet();

  const accessToken = session?.access_token || null;
  const merchantEmail = session?.user?.email || null;

  const [customers, setCustomers] = useState([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [rewardPoolBalance, setRewardPoolBalance] = useState(0n);
  const [rewardTokenAmount, setRewardTokenAmount] = useState(0n);
  const [isFunding, setIsFunding] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [isTransferPanelVisible, setIsTransferPanelVisible] = useState(false);
  const [transferWallet, setTransferWallet] = useState('');
  const [transferAmount, setTransferAmount] = useState('');

  const merchantContractAddress = useMemo(() => {
    const raw =
      MERCHANT_WALLET_ADDRESS ||
      LOYALTY_CONTRACT_ADDRESS ||
      LOYALTY_ADDRESS ||
      '';
    if (!raw) {
      return '';
    }
    try {
      return ethers.getAddress(raw);
    } catch (error) {
      return raw;
    }
  }, []);

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

  const fetchCustomers = useCallback(async () => {
    if (!accessToken) {
      toast.error('Sign in with Google to load customer data.');
      return;
    }
    try {
      setLoadingCustomers(true);
      const response = await fetch(`/api/customers?scope=all`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
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
  }, [accessToken]);

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

  const toggleTransferPanel = useCallback(() => {
    setIsTransferPanelVisible((visible) => !visible);
  }, []);

  const handleTokenTransfer = useCallback(
    async (event) => {
      event.preventDefault();
      if (!customerSigner || !customerAddress) {
        toast.error('Connect the owner wallet first.');
        return;
      }
      if (!transferWallet || !ethers.isAddress(transferWallet)) {
        toast.error('Enter a valid customer wallet address.');
        return;
      }
      if (!transferAmount || Number(transferAmount) <= 0) {
        toast.error('Enter a transfer amount greater than zero.');
        return;
      }
      try {
        if (!isCorrectNetwork) {
          await ensureCorrectNetwork();
        }
        setIsTransferring(true);
        const amountWei = ethers.parseUnits(transferAmount, 18);
        const { hash } = await transferTokensOnChain(
          { to: transferWallet, amountWei },
          customerSigner
        );
        toast.success(`Sent ${transferAmount} ${BREW_TOKEN_SYMBOL} to ${transferWallet.slice(0, 6)}… · tx: ${hash.slice(0, 10)}…`);
        setTransferAmount('');
        setTransferWallet('');
        await Promise.all([refreshRewardPool(), fetchCustomers()]);
      } catch (error) {
        console.error('Token transfer failed:', error);
        const message =
          error?.shortMessage ||
          error?.reason ||
          error?.message ||
          'Token transfer failed. Check balance and try again.';
        toast.error(message);
      } finally {
        setIsTransferring(false);
      }
    },
    [
      customerAddress,
      customerSigner,
      ensureCorrectNetwork,
      fetchCustomers,
      isCorrectNetwork,
      refreshRewardPool,
      transferAmount,
      transferWallet,
    ]
  );

  useEffect(() => {
    refreshRewardPool();
  }, [refreshRewardPool]);

  useEffect(() => {
    if (accessToken) {
      fetchCustomers();
    }
  }, [accessToken, fetchCustomers]);

  const handleRedeemReward = async (walletAddress) => {
    if (!accessToken) {
      toast.error('Sign in with Google first.');
      return;
    }
    if (!customerSigner || !customerAddress) {
      toast.error('Connect the owner wallet first.');
      return;
    }
    if (!isOwner) {
      toast.error('Connected wallet is not authorised to redeem rewards.');
      return;
    }
    try {
      if (!isCorrectNetwork) {
        await ensureCorrectNetwork();
      }
      const { hash, receipt } = await redeemRewardOnChain(walletAddress, customerSigner);
      toast.success(`Reward redeemed for ${walletAddress.slice(0, 6)}… — tx: ${hash.slice(0, 10)}…`);
      await fetch('/api/stamps', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          address: walletAddress,
          txHash: hash,
          blockNumber: receipt?.blockNumber || null,
          rewardAmountBWT: Number(ethers.formatUnits(rewardTokenAmount, 18)),
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
          {merchantContractAddress ? (
            <p className="mt-4 text-xs font-mono text-emerald-200/80">
              Contract: {shortenAddress(merchantContractAddress)}
            </p>
          ) : (
            <p className="mt-4 text-xs text-red-200">Contract address not configured.</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {merchantEmail ? (
            <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-emerald-100">
              {merchantEmail}
            </span>
          ) : null}
          <button
            onClick={fetchCustomers}
            disabled={loadingCustomers || !accessToken}
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
        <div
          className="rounded-3xl border border-blue-500/40 bg-blue-500/10 p-6 shadow-xl shadow-blue-900/40 backdrop-blur-2xl"
          onDoubleClick={toggleTransferPanel}
          title="Double-click to open advanced tools"
        >
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

      {isTransferPanelVisible && (
        <section className="rounded-3xl border border-blue-400/30 bg-blue-500/5 p-6 shadow-xl shadow-blue-900/30 backdrop-blur-2xl">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-white/40">Advanced Owner Tools</p>
              <h3 className="text-xl font-semibold text-white">Direct BrewToken Transfer</h3>
              <p className="mt-2 text-sm text-slate-300">
                Send an exact BrewToken amount from the owner wallet to any customer. Use responsibly—transactions are on-chain.
              </p>
            </div>
          </div>
          <form className="mt-6 grid gap-4 md:grid-cols-[2fr_1fr_auto]" onSubmit={handleTokenTransfer}>
            <label className="flex flex-col text-xs uppercase tracking-[0.3em] text-white/50">
              Customer Wallet
              <input
                type="text"
                value={transferWallet}
                onChange={(event) => setTransferWallet(event.target.value.trim())}
                placeholder="0x…"
                className="mt-2 rounded-full border border-white/10 bg-black/40 px-4 py-2 text-sm text-white placeholder:text-white/30 focus:border-blue-300 focus:outline-none"
                autoComplete="off"
              />
            </label>
            <label className="flex flex-col text-xs uppercase tracking-[0.3em] text-white/50">
              Amount ({BREW_TOKEN_SYMBOL})
              <input
                type="number"
                min="0"
                step="0.0001"
                value={transferAmount}
                onChange={(event) => setTransferAmount(event.target.value)}
                placeholder="25"
                className="mt-2 rounded-full border border-white/10 bg-black/40 px-4 py-2 text-sm text-white placeholder:text-white/30 focus:border-blue-300 focus:outline-none"
                autoComplete="off"
              />
            </label>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={isTransferring}
                className="w-full rounded-full border border-blue-400/40 px-6 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-blue-100 transition hover:border-blue-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isTransferring ? 'Sending…' : 'Send Tokens'}
              </button>
            </div>
          </form>
        </section>
      )}

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
                {customers.map((customer, index) => {
                  const wallet =
                    customer.wallet_address ||
                    customer.customer_wallet ||
                    customer.address ||
                    null;
                  const shortWallet = wallet
                    ? `${wallet.slice(0, 10)}…${wallet.slice(-6)}`
                    : 'Unknown';
                  const stampCount = Number(customer.stamp_count || 0);
                  const pendingRewards = Number(customer.pending_rewards || 0);
                  const totalVolume = Number(customer.total_volume || 0);
                  const lastActivity =
                    customer.last_purchase_at ||
                    customer.last_updated ||
                    customer.updated_at ||
                    null;
                  const rowKey = wallet ? wallet.toLowerCase() : `customer-${index}`;

                  return (
                    <tr key={rowKey}>
                      <td className="px-4 py-3 font-mono text-xs text-slate-100">{shortWallet}</td>
                      <td className="px-4 py-3">{stampCount}</td>
                      <td className="px-4 py-3">{pendingRewards}</td>
                      <td className="px-4 py-3">{totalVolume.toFixed(2)}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                        {lastActivity ? new Date(lastActivity).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                <button
                          onClick={() => wallet && handleRedeemReward(wallet)}
                          disabled={
                            !wallet ||
                            pendingRewards <= 0 ||
                            isFunding ||
                            loadingCustomers
                          }
                        className="rounded-full border border-emerald-400/40 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-100 transition hover:border-emerald-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Redeem Reward
                </button>
                    </td>
                  </tr>
                  );
                })}
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


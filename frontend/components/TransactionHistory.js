import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../context/WalletContext';
import { BREW_TOKEN_SYMBOL } from '../lib/constants';

const formatDate = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleString();
};

const formatAmount = (value) => {
  const amount = Number(value || 0);
  if (Number.isNaN(amount)) return '0.00';
  return amount.toFixed(2);
};

export default function TransactionHistory() {
  const { customerAddress, merchantAddress } = useWallet();
  const [purchases, setPurchases] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const targetAddress = customerAddress || merchantAddress;

  const loadHistory = useCallback(async () => {
    if (!targetAddress) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/transactions?address=${targetAddress}`);
      if (!response.ok) {
        throw new Error((await response.json())?.error || 'Unable to load transactions');
      }
      const payload = await response.json();
      setPurchases(payload.purchases || []);
      setRewards(payload.rewards || []);
    } catch (error) {
      console.error('Error loading transaction history:', error);
    } finally {
      setIsLoading(false);
    }
  }, [targetAddress]);

  useEffect(() => {
    if (targetAddress) {
      loadHistory();
    }
  }, [targetAddress, loadHistory]);

  if (!targetAddress) {
    return (
      <div className="py-12 text-center text-slate-300">
        Please connect your wallet to view transaction history.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-indigo-200">Activity Log</p>
          <h2 className="text-3xl font-semibold text-white sm:text-4xl">Purchase &amp; Reward History</h2>
        </div>
        <button
          onClick={loadHistory}
          className="inline-flex items-center justify-center rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white/80 transition hover:border-white/40 hover:text-white"
        >
          Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-slate-300">Loading history…</div>
      ) : purchases.length === 0 && rewards.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-12 text-center text-slate-300 shadow-xl shadow-indigo-900/40 backdrop-blur-2xl">
          No activity recorded yet.
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 shadow-2xl shadow-indigo-900/40 backdrop-blur-2xl">
            <h3 className="text-xl font-semibold text-white">Purchases</h3>
            {purchases.length === 0 ? (
              <p className="mt-4 text-sm text-slate-300">No purchases to display.</p>
            ) : (
              <ul className="mt-4 space-y-4">
                {purchases.map((purchase) => (
                  <li
                    key={purchase.tx_hash || `${purchase.wallet_address}-${purchase.created_at}`}
                    className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-slate-200 shadow-inner shadow-slate-900/30"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{purchase.product_name || 'Coffee Purchase'}</span>
                      <span className="text-xs text-slate-400">{formatDate(purchase.created_at)}</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-300">
                      Amount: {formatAmount(purchase.price_bwt)} {BREW_TOKEN_SYMBOL}
                    </p>
                    {purchase.tx_hash ? (
                      <p className="mt-2 text-[11px] font-mono text-blue-300">Tx: {purchase.tx_hash.slice(0, 12)}…</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 shadow-2xl shadow-indigo-900/40 backdrop-blur-2xl">
            <h3 className="text-xl font-semibold text-white">Rewards</h3>
            {rewards.length === 0 ? (
              <p className="mt-4 text-sm text-slate-300">No rewards redeemed yet.</p>
            ) : (
              <ul className="mt-4 space-y-4">
                {rewards.map((reward) => (
                  <li
                    key={reward.id || `${reward.wallet_address}-${reward.created_at}`}
                    className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-slate-200 shadow-inner shadow-slate-900/30"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Reward Redeemed</span>
                      <span className="text-xs text-slate-400">{formatDate(reward.created_at)}</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-300">
                      Payout: {formatAmount(reward.reward_amount_bwt)} {BREW_TOKEN_SYMBOL}
                    </p>
                    {reward.tx_hash ? (
                      <p className="mt-2 text-[11px] font-mono text-blue-300">Tx: {reward.tx_hash.slice(0, 12)}…</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


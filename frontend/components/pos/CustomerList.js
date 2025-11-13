import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { useWallet } from '../../context/WalletContext';
import { redeemRewardOnChain } from '../../lib/web3';

export default function CustomerList({ accessToken, onRefreshRequested }) {
  const { customerSigner, ensureCorrectNetwork, isCorrectNetwork, isConnecting, isOwner } = useWallet();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [redeemingWallet, setRedeemingWallet] = useState('');

  const fetchCustomers = useCallback(async () => {
    if (!accessToken) {
      return;
    }
    setLoading(true);
    try {
      const response = await fetch('/api/customers?scope=all', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (!response.ok) {
        throw new Error((await response.json())?.error || 'Unable to load customer list');
      }
      const payload = await response.json();
      setCustomers(payload.customers || []);
    } catch (error) {
      console.error('Customer list error:', error);
      toast.error(error?.message || 'Unable to load customers');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const totalStats = useMemo(() => {
    return customers.reduce(
      (acc, customer) => {
        const stamps = Number(customer.stamp_count || 0);
        const pendingRewards = Number(customer.pending_rewards || 0);
        const lifetime = Number(customer.lifetime_stamps || 0);
        acc.totalStamps += stamps;
        acc.pendingRewards += pendingRewards;
        acc.lifetimeStamps += lifetime;
        return acc;
      },
      { totalStamps: 0, pendingRewards: 0, lifetimeStamps: 0 }
    );
  }, [customers]);

  const handleRedeem = useCallback(
    async (walletAddress) => {
      if (!walletAddress) {
        return;
      }
      if (!customerSigner) {
        toast.error('Connect the merchant wallet in MetaMask to redeem rewards.');
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
        setRedeemingWallet(walletAddress);
        const { hash, receipt } = await redeemRewardOnChain(walletAddress, customerSigner);
        toast.success(
          `Reward redeemed for ${walletAddress.slice(0, 6)}… — tx ${hash.slice(0, 10)}…`
        );
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
            rewardAmountBWT: null,
          }),
        });
        await fetchCustomers();
        if (typeof onRefreshRequested === 'function') {
          onRefreshRequested();
        }
      } catch (error) {
        console.error('Reward redemption failed:', error);
        const message =
          error?.shortMessage ||
          error?.reason ||
          error?.message ||
          'Unable to redeem reward';
        toast.error(message);
      } finally {
        setRedeemingWallet('');
      }
    },
    [
      accessToken,
      customerSigner,
      ensureCorrectNetwork,
      fetchCustomers,
      isCorrectNetwork,
      isOwner,
      onRefreshRequested,
    ]
  );

  return (
    <section className="mt-12 rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl shadow-indigo-900/30 backdrop-blur-2xl">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-white/50">Loyalty Overview</p>
          <h3 className="text-2xl font-semibold text-white">Customer Rewards</h3>
          <p className="mt-1 text-sm text-slate-300">
            Track stamp progress, pending rewards, and lifetime BrewToken orders.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={fetchCustomers}
            disabled={loading || !accessToken}
            className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <div className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 text-xs text-emerald-200">
            <span className="uppercase tracking-[0.3em]">Pending rewards:</span>{' '}
            <span>{totalStats.pendingRewards}</span>
          </div>
        </div>
      </header>

      {customers.length === 0 ? (
        <p className="mt-6 text-sm text-slate-300">
          {loading ? 'Loading customers…' : 'No customer orders yet.'}
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10 text-sm text-slate-200">
            <caption className="pb-4 text-left text-xs uppercase tracking-[0.3em] text-white/40">
              Total stamps: {totalStats.totalStamps} · Pending rewards: {totalStats.pendingRewards} ·
              Lifetime stamps: {totalStats.lifetimeStamps}
            </caption>
            <thead>
              <tr className="text-left text-xs uppercase tracking-[0.3em] text-white/50">
                <th className="px-4 py-2">Customer</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Stamp Count</th>
                <th className="px-4 py-2">Pending Rewards</th>
                <th className="px-4 py-2">Reward Eligible</th>
                <th className="px-4 py-2">Last Updated</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {customers.map((customer) => {
                const wallet = customer.customer_wallet || customer.wallet_address;
                const pending = Number(customer.pending_rewards || 0);
                const rewardEligible = customer.reward_eligible || pending > 0;
                const stampCount = Number(customer.stamp_count || 0);
                const lastUpdated = customer.last_updated
                  ? new Date(customer.last_updated).toLocaleString()
                  : '—';
                const shortWallet = wallet
                  ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}`
                  : 'Unknown';
                return (
                  <tr key={wallet}>
                    <td className="px-4 py-3 font-mono text-xs text-slate-100">{shortWallet}</td>
                    <td className="px-4 py-3 text-xs text-slate-300">{customer.email || '—'}</td>
                    <td className="px-4 py-3">{stampCount}</td>
                    <td className="px-4 py-3">{pending}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] ${
                          rewardEligible
                            ? 'bg-emerald-400/10 text-emerald-200'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {rewardEligible ? 'Ready' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{lastUpdated}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        disabled={
                          pending <= 0 ||
                          !rewardEligible ||
                          isConnecting ||
                          redeemingWallet === wallet ||
                          !accessToken
                        }
                        onClick={() => handleRedeem(wallet)}
                        className="rounded-full border border-emerald-400/40 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-100 transition hover:border-emerald-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {redeemingWallet === wallet ? 'Redeeming…' : 'Redeem Reward'}
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
  );
}



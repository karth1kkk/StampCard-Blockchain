import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import QRCode from 'react-qr-code';
import { toast } from 'react-toastify';
import { useWallet } from '../context/WalletContext';
import { getStampCount, getRewardCount, getRewardThreshold, redeemReward } from '../lib/web3';

export default function CustomerDashboard() {
  const { account, provider, signer, isCorrectNetwork } = useWallet();
  const [stampCount, setStampCount] = useState(0);
  const [rewardCount, setRewardCount] = useState(0);
  const [rewardThreshold, setRewardThreshold] = useState(8);
  const [isLoading, setIsLoading] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);

  const loadCounts = useCallback(async () => {
    if (!account || !provider || !isCorrectNetwork) {
      setStampCount(0);
      setRewardCount(0);
      return;
    }

    setIsLoading(true);
    try {
      const [threshold, stamps, rewards] = await Promise.all([
        getRewardThreshold(provider),
        getStampCount(account, provider),
        getRewardCount(account, provider),
      ]);
      setRewardThreshold(threshold || 8);
      setStampCount(stamps);
      setRewardCount(rewards);
    } catch (error) {
      console.error('Failed to load customer balances:', error);
      toast.error(error?.message || 'Unable to load your stamp balance');
    } finally {
      setIsLoading(false);
    }
  }, [account, provider, isCorrectNetwork]);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  useEffect(() => {
    if (!account || !provider) return;

    const interval = setInterval(loadCounts, 15000);
    return () => clearInterval(interval);
  }, [account, provider, loadCounts]);

  const handleRedeem = async () => {
    if (!account || !signer) {
      toast.error('Connect your wallet before redeeming rewards.');
      return;
    }
    if (rewardCount === 0) {
      toast.info('No rewards available to redeem yet.');
      return;
    }

    setIsRedeeming(true);
    try {
      const { hash } = await redeemReward(account, signer);
      toast.success(`Reward redeemed. Tx: ${hash.slice(0, 10)}…`);
      await loadCounts();
    } catch (error) {
      console.error('Redeem failed:', error);
      toast.error(error?.shortMessage || error?.message || 'Reward redemption failed');
    } finally {
      setIsRedeeming(false);
    }
  };

  if (!account) {
    return (
      <div className="py-12 text-center text-slate-300">
        Connect your wallet to view your digital stamp card.
      </div>
    );
  }

  const cycleStamps = rewardThreshold ? stampCount % rewardThreshold : 0;
  const stampsNeeded =
    rewardThreshold && cycleStamps === 0 ? rewardThreshold : rewardThreshold - cycleStamps;
  const progress = rewardThreshold ? Math.min((cycleStamps / rewardThreshold) * 100, 100) : 0;
  const qrValue = useMemo(() => account, [account]);
  const stampSlots = useMemo(
    () =>
      Array.from({ length: rewardThreshold || 0 }, (_, index) => ({
        index,
        filled: index < cycleStamps,
      })),
    [rewardThreshold, cycleStamps]
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-blue-200">Customer Portal</p>
          <h2 className="text-3xl font-semibold text-white sm:text-4xl">Customer Dashboard</h2>
          <p className="mt-2 text-sm text-slate-300">
            Scan merchant QR codes to request stamps directly from your wallet.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/customer/scan"
            className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-emerald-400 via-teal-400 to-blue-500 px-5 py-2 text-xs font-semibold uppercase tracking-widest text-slate-900 shadow-lg shadow-emerald-400/40 transition hover:scale-[1.02]"
          >
            Open Stamp Scanner
          </Link>
          <button
            onClick={loadCounts}
            className="inline-flex items-center justify-center rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white/80 transition hover:border-white/40 hover:text-white"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-blue-500/20 bg-blue-500/10 p-6 shadow-[0_40px_120px_-45px_rgba(59,130,246,0.75)] backdrop-blur-xl">
        <div className="absolute -right-24 top-1/2 h-44 w-44 -translate-y-1/2 rounded-full bg-blue-400/20 blur-[120px]" />
        <h3 className="relative font-semibold text-blue-100">How stamping works</h3>
        <ol className="relative mt-4 space-y-2 text-sm text-blue-100/80 list-decimal list-inside">
          <li>Scan the merchant&apos;s StampCard QR after your purchase.</li>
          <li>The app requests a merchant-signed challenge and submits the on-chain transaction.</li>
          <li>You sign and pay network fees; the contract mints your stamp.</li>
          <li>Every {rewardThreshold} stamps automatically grant a reward token.</li>
          <li>Redeem rewards directly from this dashboard whenever you like.</li>
        </ol>
        <div className="relative mt-4 flex flex-wrap items-center gap-3 text-xs text-blue-100">
          <span className="font-semibold uppercase tracking-widest text-blue-200">Wallet</span>
          <code className="rounded-full bg-blue-400/20 px-3 py-1 font-mono text-blue-100">
            {account.slice(0, 10)}...{account.slice(-6)}
          </code>
          <button
            onClick={() => {
              navigator.clipboard.writeText(account);
              toast.success('Address copied to clipboard!');
            }}
            className="inline-flex items-center text-blue-100 underline decoration-blue-200/60 decoration-dashed underline-offset-4 transition hover:text-white"
          >
            Copy
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-slate-300">Loading latest stamp data…</div>
      ) : (
        <>
          <div className="relative mx-auto max-w-[28rem] overflow-hidden rounded-3xl border border-yellow-400/40 bg-gradient-to-br from-slate-900/70 via-slate-900/30 to-amber-500/10 p-6 shadow-[0_45px_140px_-65px_rgba(251,191,36,0.9)] md:max-w-[32rem]">
            <div className="pointer-events-none absolute -left-24 -top-20 h-56 w-56 rounded-full bg-amber-500/20 blur-[140px]" />
            <div className="pointer-events-none absolute -right-20 -bottom-24 h-64 w-64 rounded-full bg-amber-400/25 blur-[160px]" />
            <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-amber-200">Loyalty Passport</p>
                <h3 className="text-2xl font-black text-white">Stamp &amp; Sip Card</h3>
                <p className="mt-1 text-sm text-amber-100/80">
                  Collect {rewardThreshold} stamps to unlock a reward. Show this card before
                  every purchase.
                </p>
              </div>
              {qrValue ? (
                <div className="flex flex-col items-center gap-2 rounded-2xl bg-black/40 p-4 text-center shadow-inner shadow-amber-500/20 ring-1 ring-amber-100/20">
                  <span className="text-xs font-semibold uppercase tracking-wide text-amber-200">
                    Customer QR
                  </span>
                  <QRCode value={qrValue} size={116} bgColor="#0f172a" fgColor="#fbbf24" />
                  <p className="text-[10px] font-mono uppercase tracking-wide text-amber-100/70">
                    {account?.slice(0, 6)}…{account?.slice(-4)}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="relative z-10 mt-6 rounded-2xl border border-amber-300/40 bg-black/30 p-5 shadow-inner shadow-amber-500/20">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold uppercase tracking-wide text-amber-200">
                  Free Drink Tracker
                </span>
                <span className="rounded-full border border-amber-200/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-amber-200">
                  {rewardThreshold} Needed
                </span>
              </div>
              <div className="mt-6 grid grid-cols-4 gap-5">
                {stampSlots.map(({ index, filled }) => (
                  <div
                    key={index}
                    className={`relative flex h-24 items-center justify-center rounded-full border-4 text-2xl font-black tracking-wide transition-all duration-300 ${
                      filled
                        ? 'border-amber-400 bg-gradient-to-br from-amber-400 to-amber-500 text-slate-900 shadow-[0_15px_45px_-25px_rgba(251,191,36,0.9)]'
                        : 'border-dashed border-amber-200/40 bg-gradient-to-br from-slate-900 to-slate-800 text-amber-200'
                    }`}
                  >
                    {filled ? 'STAMPED' : index + 1}
                    <span
                      className={`absolute inset-1 rounded-full border ${
                        filled ? 'border-white/40' : 'border-amber-100/20'
                      }`}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-5 flex items-center justify-between text-xs uppercase tracking-widest text-amber-100/70">
                <span>Collect &amp; Enjoy</span>
                <span>Redeem For Free Drink</span>
              </div>
            </div>
          </div>

          {/* Stamp Count Card */}
          <div className="rounded-3xl border border-blue-500/20 bg-blue-500/10 p-6 shadow-xl shadow-blue-900/40 backdrop-blur-2xl sm:p-8">
            <h3 className="text-xl font-semibold text-white">Your Stamps</h3>
            <div className="mt-3 text-5xl font-bold text-blue-100">{stampCount}</div>
            <div className="mt-3">
              <div className="flex justify-between text-xs uppercase tracking-widest text-blue-100/70">
                <span>Progress to next reward</span>
                <span>
                  {cycleStamps}/{rewardThreshold}
                </span>
              </div>
              <div className="mt-2 h-3 w-full rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            <p className="mt-3 text-sm text-blue-100/80">
              {stampsNeeded === rewardThreshold
                ? 'Start collecting stamps!'
                : `${stampsNeeded} more stamps until your next reward`}
            </p>
          </div>

          {/* Reward Count Card */}
          <div className="rounded-3xl border border-emerald-400/30 bg-emerald-400/10 p-6 shadow-xl shadow-emerald-900/40 backdrop-blur-2xl sm:p-8">
            <h3 className="text-xl font-semibold text-white">Your Rewards</h3>
            <div className="mt-3 text-5xl font-bold text-emerald-100">{rewardCount}</div>
            <button
              onClick={handleRedeem}
              disabled={rewardCount === 0 || isRedeeming}
              className="mt-6 w-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-300 px-6 py-3 text-xs font-semibold uppercase tracking-widest text-slate-900 shadow-lg shadow-emerald-400/30 transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isRedeeming ? 'Redeeming...' : 'Redeem Reward'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}


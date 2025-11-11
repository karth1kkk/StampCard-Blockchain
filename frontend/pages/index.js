import { useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import WalletConnect from '../components/WalletConnect';
import CustomerDashboard from '../components/CustomerDashboard';
import MerchantDashboard from '../components/MerchantDashboard';
import TransactionHistory from '../components/TransactionHistory';
import { useWallet } from '../context/WalletContext';
import { NATIVE_SYMBOL } from '../lib/constants';

const marketingHighlights = [
  { label: 'Active Wallets', value: '300K+', description: 'Across connected loyalty programs' },
  { label: 'Rewards Delivered', value: '1.2M+', description: 'Automated customer perks' },
  { label: 'Settlement Speed', value: '<30s', description: 'Average confirmation window' },
  { label: 'Security Score', value: 'AAA', description: 'Audited smart contract stack' },
];

const featureCards = [
  {
    title: 'Instant Settlement',
    description: `Trigger QR-based ${NATIVE_SYMBOL} payments that clear in seconds with on-chain proof.`,
  },
  {
    title: 'Automated Rewards',
    description: 'Smart contracts auto-issue perks the moment customers hit their milestones.',
  },
  {
    title: 'Multi-Outlet Ready',
    description: 'Scale loyalty across franchises with granular owner permissions.',
  },
  {
    title: 'Real-Time Analytics',
    description: 'Track stamp velocity, engaged customers, and redemption health at a glance.',
  },
];

export default function Home() {
  const { account, isOwner } = useWallet();
  const [activeTab, setActiveTab] = useState('customer');

  const tabs = useMemo(() => {
    const base = [
      { id: 'customer', label: 'Customer' },
      ...(isOwner ? [{ id: 'merchant', label: 'Merchant' }] : []),
      { id: 'history', label: 'History' },
    ];
    return base;
  }, [isOwner]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <Head>
        <title>StampCard Blockchain - Loyalty Stamp Card System</title>
        <meta name="description" content="Blockchain-based loyalty stamp card system for F&B industry" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="absolute inset-0 -z-10 opacity-60">
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[38rem] w-[38rem] -translate-x-1/2 rounded-full bg-blue-500/30 blur-[140px]" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-[28rem] w-[28rem] translate-x-1/3 rounded-full bg-purple-500/25 blur-[160px]" />
      </div>

      <header className="sticky top-0 z-30 border-b border-white/5 bg-slate-950/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 shadow-lg shadow-blue-500/40">
              <span className="text-xl font-semibold text-white">SC</span>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-white/50">StampCard</p>
              <h1 className="text-lg font-semibold text-white sm:text-xl">Blockchain Loyalty Network</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/merchant/login"
              className="hidden rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/80 transition hover:border-emerald-300/60 hover:text-emerald-200 sm:inline-flex"
            >
              Merchant Login
            </Link>
            <WalletConnect />
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-12 px-4 py-10 sm:px-6 lg:px-8">
        {!account ? (
          <>
            <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-10 text-center shadow-2xl backdrop-blur-xl sm:p-16">
              <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/60 to-transparent" />
              <div className="mx-auto max-w-3xl space-y-6">
                <span className="inline-flex items-center justify-center rounded-full border border-blue-400/40 bg-blue-400/10 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-blue-200">
                  Web3 Loyalty Infrastructure
                </span>
                <h2 className="text-4xl font-bold leading-tight text-white sm:text-5xl">
                  Powering On-Chain Rewards &amp; Real-Time Payments
                </h2>
                <p className="text-lg text-slate-300">
                  Connect your MetaMask wallet to launch an immersive loyalty experience. Collect digital
                  stamps, automate rewards, and settle payments in a single interface.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-4">
                  <WalletConnect />
                  <button
                    type="button"
                    className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/10"
                  >
                    Explore Documentation
                  </button>
                </div>
              </div>
              <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {marketingHighlights.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-white/10 bg-black/20 p-5 text-left shadow-lg shadow-black/20"
                  >
                    <p className="text-sm uppercase tracking-widest text-white/60">{item.label}</p>
                    <p className="mt-3 text-3xl font-semibold text-white">{item.value}</p>
                    <p className="mt-2 text-sm text-slate-400">{item.description}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {featureCards.map((feature) => (
                <article
                  key={feature.title}
                  className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-lg shadow-indigo-900/30 backdrop-blur-xl transition-all hover:-translate-y-1 hover:border-blue-400/50 hover:bg-blue-400/10"
                >
                  <div className="absolute -right-20 -top-24 h-40 w-40 rounded-full bg-blue-500/10 blur-[90px]" />
                  <div className="relative space-y-4">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-purple-500 text-white shadow-lg shadow-blue-500/30">
                      <span className="text-lg font-semibold">◎</span>
                    </div>
                    <h3 className="text-xl font-semibold text-white">{feature.title}</h3>
                    <p className="text-sm text-slate-300">{feature.description}</p>
                  </div>
                </article>
              ))}
            </section>
          </>
        ) : (
          <div className="space-y-10">
            <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-xl shadow-blue-900/30 backdrop-blur-2xl sm:flex-row sm:items-center sm:justify-between sm:p-8">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-blue-200">Active Session</p>
                <h2 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">Loyalty Command Center</h2>
                <p className="mt-3 max-w-xl text-sm text-slate-300">
                  Manage payments, stamp issuance, and transaction history without leaving this dashboard.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      activeTab === tab.id
                        ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/40'
                        : 'border border-white/20 text-slate-300 hover:border-white/40 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <section className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 shadow-2xl shadow-indigo-900/30 backdrop-blur-2xl sm:p-10">
              {activeTab === 'customer' && <CustomerDashboard />}
              {activeTab === 'merchant' && isOwner && <MerchantDashboard />}
              {activeTab === 'history' && <TransactionHistory />}
            </section>
          </div>
        )}
      </main>

      <footer className="border-t border-white/10 bg-slate-950/60 py-6 text-center text-xs text-slate-400 backdrop-blur">
        StampCard Blockchain · Built for next-gen loyalty ecosystems
      </footer>
    </div>
  );
}


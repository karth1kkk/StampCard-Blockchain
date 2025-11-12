import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import WalletConnect from '../components/WalletConnect';
import CustomerDashboard from '../components/CustomerDashboard';
import MerchantDashboard from '../components/MerchantDashboard';
import TransactionHistory from '../components/TransactionHistory';
import { useWallet } from '../context/WalletContext';
import { NATIVE_SYMBOL } from '../lib/constants';

const heroHighlights = [
  { value: '4.9⭐', label: 'App Store Rating' },
  { value: '30s', label: 'Average reward settlement' },
  { value: '100%', label: 'Contactless stamp validation' },
];

const promiseCards = [
  {
    title: 'Simple to use',
    description: 'Feels just like a punch card, but automated with secure QR scans.',
  },
  {
    title: 'Fast to launch',
    description: 'No POS integration required—deploy the smart contract and start stamping.',
  },
  {
    title: 'Try it free',
    description: 'Local Hardhat network and Supabase sandbox let you test every flow safely.',
  },
];

const howItWorks = [
  {
    step: '1',
    title: 'Customer scans & connects',
    description:
      'Your guest scans the outlet QR and links their wallet through MetaMask or WalletConnect.',
  },
  {
    step: '2',
    title: 'Merchant signs challenge',
    description:
      'An authorised merchant key signs a challenge, ensuring every stamp request is legitimate.',
  },
  {
    step: '3',
    title: 'Smart contract mints stamp',
    description:
      `Customers confirm the on-chain transaction, instantly minting an ERC-1155 stamp and tracking progress toward ${NATIVE_SYMBOL} rewards.`,
  },
];

const differentiators = [
  {
    title: 'Real-time analytics',
    description: 'Monitor stamp velocity, reward conversion, and outlet performance at a glance.',
  },
  {
    title: 'Merchant-first controls',
    description:
      'Allowlist signer wallets, register outlets, and publish QR payloads directly from the dashboard.',
  },
  {
    title: 'Built for scale',
    description:
      'Supports multi-outlet brands, Supabase-backed metadata, and secure replay-protected signatures.',
  },
];

const insightArticles = [
  {
    title: 'How digital stamps increase repeat visits',
    date: 'Nov 2025',
  },
  {
    title: 'Designing QR-first customer journeys',
    date: 'Oct 2025',
  },
  {
    title: 'Preventing fraud with merchant-signed challenges',
    date: 'Sep 2025',
  },
];

export default function Home() {
  const { account, isOwner, isMerchant } = useWallet();
  const [activeTab, setActiveTab] = useState('customer');

  const tabs = useMemo(() => {
    const base = [
      { id: 'customer', label: 'Customer' },
      ...(isOwner || isMerchant
        ? [{ id: 'merchant', label: isOwner ? 'Merchant' : 'Merchant (Authorised)' }]
        : []),
      { id: 'history', label: 'History' },
    ];
    return base;
  }, [isOwner, isMerchant]);

  useEffect(() => {
    if (activeTab === 'merchant' && !(isOwner || isMerchant)) {
      setActiveTab('customer');
    }
  }, [activeTab, isOwner, isMerchant]);

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
            <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-8 shadow-2xl backdrop-blur-xl sm:p-16">
              <div className="absolute inset-y-0 right-0 hidden w-1/2 bg-gradient-to-br from-blue-500/10 via-indigo-500/10 to-purple-600/10 blur-[120px] sm:block" />
              <div className="relative grid gap-12 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-8 text-left">
                  <span className="inline-flex items-center rounded-full border border-blue-400/40 bg-blue-400/10 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.42em] text-blue-200">
                    #1 digital stamp card experience
                  </span>
                  <div className="space-y-5">
                    <h2 className="text-4xl font-bold leading-tight text-white sm:text-5xl">
                      Delight customers with secure, QR-first stamp cards.
                    </h2>
                    <p className="text-lg text-slate-200">
                      StampCard brings the familiarity of punch cards into the on-chain era—customers
                      request stamps, merchants authorise them, and rewards land instantly in their
                      wallets.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <Link
                      href="/merchant/login"
                      className="rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/40 transition hover:scale-[1.01]"
                    >
                      Get Started Free
                    </Link>
                    <button
                      type="button"
                      className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/10"
                    >
                      Watch Demo
                    </button>
                    <div className="hidden sm:block">
                      <WalletConnect />
                    </div>
                  </div>
                </div>
                <div className="flex flex-col justify-between gap-6 rounded-3xl border border-white/10 bg-black/30 p-6 text-left shadow-inner shadow-blue-900/20">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-white/60">
                    Why brands choose StampCard
                  </h3>
                  <div className="space-y-6">
                    {heroHighlights.map((item) => (
                      <div key={item.label} className="flex items-center gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 text-md font-semibold text-white shadow-lg shadow-blue-500/40">
                          {item.value}
                        </div>
                        <p className="text-sm text-slate-300">{item.label}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400">
                    Built for coffee shops, salons, retailers, and enterprise franchises that demand
                    contactless loyalty with verifiable trust.
                  </p>
                </div>
              </div>
            </section>

            <section className="grid gap-6 text-left sm:grid-cols-2 lg:grid-cols-3">
              {promiseCards.map((card) => (
                <article
                  key={card.title}
                  className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-lg shadow-indigo-900/30 backdrop-blur-xl transition hover:-translate-y-1"
                >
                  <div className="absolute -right-16 -top-10 h-32 w-32 rounded-full bg-blue-500/10 blur-[80px]" />
                  <div className="relative space-y-4">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-purple-500 text-lg font-semibold text-white shadow-lg shadow-blue-500/40">
                      ◎
                    </div>
                    <h3 className="text-xl font-semibold text-white">{card.title}</h3>
                    <p className="text-sm text-slate-300">{card.description}</p>
                  </div>
                </article>
              ))}
            </section>

            <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] p-8 shadow-2xl shadow-indigo-900/30 backdrop-blur-2xl sm:p-12">
              <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
                <div className="space-y-5">
                  <p className="text-xs uppercase tracking-[0.4em] text-blue-200">How it works</p>
                  <h3 className="text-3xl font-semibold text-white sm:text-4xl">
                    A customer-first journey—secure for merchants, delightful for members.
                  </h3>
                  <p className="text-sm text-slate-300">
                    Every stamp request starts with your customer and finishes with cryptographic
                    verification. No manual punch cards, no manual reconciliation.
                  </p>
                </div>
                <div className="grid gap-6">
                  {howItWorks.map((item) => (
                    <div
                      key={item.step}
                      className="rounded-3xl border border-blue-400/20 bg-blue-400/10 p-6 shadow-lg shadow-blue-900/30"
                    >
                      <div className="flex items-center gap-4">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-sm font-semibold uppercase tracking-[0.3em] text-white/80">
                          {item.step}
                        </span>
                        <h4 className="text-lg font-semibold text-white">{item.title}</h4>
                      </div>
                      <p className="mt-3 text-sm text-slate-200">{item.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-3">
              {differentiators.map((item) => (
                <article
                  key={item.title}
                  className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-left shadow-xl shadow-indigo-900/30 backdrop-blur-xl"
                >
                  <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                  <p className="mt-3 text-sm text-slate-300">{item.description}</p>
                </article>
              ))}
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.02] p-8 shadow-xl shadow-indigo-900/30 backdrop-blur-2xl sm:p-10">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-purple-200">Latest insights</p>
                  <h3 className="mt-2 text-2xl font-semibold text-white">Ideas to grow loyalty faster</h3>
                </div>
                <Link
                  href="/merchant/login"
                  className="inline-flex items-center justify-center rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/80 transition hover:border-white/40 hover:text-white"
                >
                  Explore Resources
                </Link>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                {insightArticles.map((article) => (
                  <div
                    key={article.title}
                    className="rounded-2xl border border-white/10 bg-black/30 p-5 shadow-inner shadow-blue-900/20"
                  >
                    <p className="text-[11px] uppercase tracking-[0.3em] text-white/50">{article.date}</p>
                    <p className="mt-3 text-sm font-semibold text-white">{article.title}</p>
                    <p className="mt-2 text-xs text-slate-400">
                      Discover how leading venues are rolling out QR-first loyalty with verifiable trust.
                    </p>
                  </div>
                ))}
              </div>
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
              {activeTab === 'merchant' && (isOwner || isMerchant) && <MerchantDashboard />}
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



import Head from 'next/head';
import Link from 'next/link';
import MerchantDashboard from '../../components/MerchantDashboard';
import WalletConnect from '../../components/WalletConnect';
import { useWallet } from '../../context/WalletContext';

export default function MerchantHomePage() {
  const { merchantAddress, isOwner, isOwnerLoading, isCorrectNetwork } = useWallet();

  const showDashboard = merchantAddress && isOwner && isCorrectNetwork;
  const showLoading = merchantAddress && isOwnerLoading;

  return (
    <>
      <Head>
        <title>Merchant Dashboard · StampCard</title>
      </Head>
      <div className="min-h-screen bg-slate-950/96">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-12 sm:px-6 lg:px-8">
          <header className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-xl shadow-indigo-900/30 backdrop-blur-2xl sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-purple-200">Merchant Portal</p>
              <h1 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">
                Merchant Operations Console
              </h1>
              <p className="mt-3 text-sm text-slate-300">
                Manage outlets, authorise signer keys, and generate QR payloads for your customers.
              </p>
            </div>
            <WalletConnect />
          </header>

          {!merchantAddress ? (
            <GuardCard
              title="Connect Owner Wallet"
              message="A wallet connection is required to verify ownership. Only the contract owner can access merchant tooling."
              actionLabel="Go to Merchant Login"
              actionHref="/merchant/login"
            />
          ) : !isCorrectNetwork ? (
            <GuardCard
              title="Wrong Network"
              message="Switch your wallet to the configured StampCard network, then reload this page."
              actionLabel="Back to Merchant Login"
              actionHref="/merchant/login"
            />
          ) : showLoading ? (
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-12 text-center text-slate-300 shadow-xl shadow-indigo-900/30 backdrop-blur-2xl">
              Checking owner permissions…
            </div>
          ) : showDashboard ? (
            <MerchantDashboard />
          ) : (
            <GuardCard
              title="Owner Permissions Required"
              message="The connected wallet is not recognised as the contract owner. Connect the deployer wallet and try again."
              actionLabel="Merchant Login Help"
              actionHref="/merchant/login"
            />
          )}
        </div>
      </div>
    </>
  );
}

function GuardCard({ title, message, actionLabel, actionHref }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-12 text-center text-slate-200 shadow-xl shadow-indigo-900/40 backdrop-blur-2xl">
      <h2 className="text-2xl font-semibold text-white">{title}</h2>
      <p className="mt-4 text-sm text-slate-300">{message}</p>
      <Link
        href={actionHref}
        className="mt-6 inline-flex items-center justify-center rounded-full border border-white/20 px-5 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/80 transition hover:border-white/40 hover:text-white"
      >
        {actionLabel}
      </Link>
    </div>
  );
}



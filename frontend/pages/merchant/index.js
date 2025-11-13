import Head from 'next/head';
import MerchantDashboard from '../../components/MerchantDashboard';
import WalletConnect from '../../components/WalletConnect';
import { useWallet } from '../../context/WalletContext';

export default function MerchantHomePage() {
  const { customerAddress, isOwner, isOwnerLoading, isCorrectNetwork } = useWallet();

  const showDashboard = customerAddress && isOwner && isCorrectNetwork;
  const showLoading = customerAddress && isOwnerLoading;

  return (
    <>
      <Head>
        <title>Merchant Dashboard · BrewToken Loyalty</title>
      </Head>
      <div className="min-h-screen bg-slate-950/96">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-12 sm:px-6 lg:px-8">
          <header className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-xl shadow-indigo-900/30 backdrop-blur-2xl sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-purple-200">Merchant Portal</p>
              <h1 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">
                Coffee Loyalty Operations Console
              </h1>
              <p className="mt-3 text-sm text-slate-300">
                View customer progress, redeem free drinks, and generate QR codes for BrewToken payments.
              </p>
            </div>
            <WalletConnect />
          </header>

          {!customerAddress ? (
            <GuardCard
              title="Connect Owner Wallet"
              message="Connect the wallet that deployed the CoffeeLoyalty contract to manage merchant tooling."
            />
          ) : !isCorrectNetwork ? (
            <GuardCard
              title="Wrong Network"
              message="Switch your wallet to the configured loyalty network, then reload this page."
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
            />
          )}
        </div>
      </div>
    </>
  );
}

function GuardCard({ title, message }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-12 text-center text-slate-200 shadow-xl shadow-indigo-900/40 backdrop-blur-2xl">
      <h2 className="text-2xl font-semibold text-white">{title}</h2>
      <p className="mt-4 text-sm text-slate-300">{message}</p>
    </div>
  );
}



import Head from 'next/head';
import Link from 'next/link';
import WalletConnect from '../../components/WalletConnect';
import { useWallet } from '../../context/WalletContext';
import { stampCardChain } from '../../lib/wagmiConfig';

const HARDHAT_STEPS = [
  'Run `npm run hardhat:node` in a dedicated terminal.',
  'Copy the first private key printed in the Hardhat node output.',
  'In MetaMask → Account menu → “Import account”, paste the private key.',
  `Ensure MetaMask is on the ${stampCardChain.name} network (${stampCardChain.rpcUrls.default.http[0]}).`,
];

export default function MerchantLoginPage() {
  const { account, isOwner, isCorrectNetwork } = useWallet();
  const readyForDashboard = account && isOwner && isCorrectNetwork;

  return (
    <>
      <Head>
        <title>Merchant Login · StampCard</title>
      </Head>
      <div className="min-h-screen bg-slate-950/96">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-4 py-12 sm:px-6 lg:px-8">
          <header className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-xl shadow-blue-900/30 backdrop-blur-2xl sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-blue-200">Merchant Portal</p>
              <h1 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">
                Sign in as Contract Owner
              </h1>
              <p className="mt-3 text-sm text-slate-300">
                Connect the wallet that deployed the StampCard contract. Once verified, you will gain
                access to the Merchant Dashboard.
              </p>
            </div>
            <WalletConnect />
          </header>

          <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-3xl border border-blue-500/20 bg-blue-500/10 p-6 shadow-2xl shadow-blue-900/40 backdrop-blur-2xl sm:p-8">
              <h2 className="text-xl font-semibold text-white">Connect the Deployer Wallet</h2>
              <p className="mt-3 text-sm text-slate-200">
                The dashboard automatically grants owner permissions to the account that deployed the
                contract. Follow the steps below if you are using the default Hardhat network.
              </p>
              <ol className="mt-5 space-y-3 text-sm text-blue-100/80 list-decimal list-inside">
                {HARDHAT_STEPS.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
              <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4 text-xs text-slate-300">
                <p className="font-semibold uppercase tracking-[0.3em] text-white/60">Need help?</p>
                <p className="mt-2">
                  Review the “Merchant Signing Endpoint” section in the README or update
                  `MERCHANT_SIGNER_PRIVATE_KEY` in `frontend/.env.local` for local testing.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <div className="rounded-3xl border border-emerald-400/30 bg-emerald-400/10 p-6 shadow-xl shadow-emerald-900/40 backdrop-blur-2xl sm:p-8">
                <h2 className="text-xl font-semibold text-white">Connection Status</h2>
                <div className="mt-4 space-y-3 text-sm">
                  <StatusRow
                    label="Wallet Connected"
                    state={account ? 'Ready' : 'Pending'}
                    tone={account ? 'success' : 'warning'}
                    helper={account || 'Connect your wallet via the button above.'}
                  />
                  <StatusRow
                    label="Correct Network"
                    state={isCorrectNetwork ? 'Ready' : 'Pending'}
                    tone={isCorrectNetwork ? 'success' : 'warning'}
                    helper={
                      isCorrectNetwork
                        ? `Connected to ${stampCardChain.name}.`
                        : 'Switch to the Hardhat Local network.'
                    }
                  />
                  <StatusRow
                    label="Owner Verification"
                    state={account ? (isOwner ? 'Ready' : 'Blocked') : 'Pending'}
                    tone={!account ? 'warning' : isOwner ? 'success' : 'error'}
                    helper={
                      !account
                        ? 'Connect the deployer wallet to continue.'
                        : isOwner
                        ? 'Wallet matches the contract owner.'
                        : 'This wallet did not deploy the contract.'
                    }
                  />
                </div>
                <Link
                  href="/merchant"
                  className={`mt-6 inline-flex items-center justify-center rounded-full px-6 py-3 text-xs font-semibold uppercase tracking-[0.3em] transition ${
                    readyForDashboard
                      ? 'bg-gradient-to-r from-emerald-300 via-lime-300 to-sky-300 text-slate-900 shadow-lg shadow-emerald-400/30 hover:scale-[1.02]'
                      : 'cursor-not-allowed border border-white/20 text-white/50'
                  }`}
                  aria-disabled={!readyForDashboard}
                >
                  {readyForDashboard ? 'Open Merchant Dashboard' : 'Awaiting Owner Wallet'}
                </Link>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-sm text-slate-200 shadow-xl shadow-indigo-900/30 backdrop-blur-2xl">
                <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-white/60">
                  Troubleshooting
                </h3>
                <ul className="mt-3 space-y-2 list-disc pl-5">
                  <li>Restart the Next.js dev server after deploying the contract.</li>
                  <li>Verify `NEXT_PUBLIC_CONTRACT_ADDRESS` matches the latest deployment.</li>
                  <li>
                    If you use a different RPC or chain id, update `NEXT_PUBLIC_CHAIN_ID` and restart
                    the app.
                  </li>
                </ul>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function StatusRow({ label, state, tone, helper }) {
  const toneStyles = {
    success: 'bg-emerald-400/10 text-emerald-100 border border-emerald-400/30',
    warning: 'bg-amber-500/10 text-amber-100 border border-amber-400/30',
    error: 'bg-red-500/10 text-red-100 border border-red-400/30',
  };

  return (
    <div className={`rounded-2xl ${toneStyles[tone] || toneStyles.warning} p-4`}>
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em]">
        <span>{label}</span>
        <span className="font-semibold">{state}</span>
      </div>
      <p className="mt-2 text-xs text-white/80">{helper}</p>
    </div>
  );
}



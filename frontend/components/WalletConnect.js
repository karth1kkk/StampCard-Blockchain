import { useState } from 'react';
import { toast } from 'react-toastify';
import { useWallet } from '../context/WalletContext';

const shortenAddress = (address) =>
  address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '';
const formatBalance = (balance) => {
  const parsed = Number.parseFloat(balance ?? '0');
  if (Number.isNaN(parsed)) {
    return '0.0000';
  }
  return parsed.toFixed(4);
};

export default function WalletConnect() {
  const {
    customerAddress,
    merchantAddress,
    customerBalance,
    merchantBalance,
    connectCustomerWallet,
    connectMerchantWallet,
    disconnectCustomerWallet,
    disconnectMerchantWallet,
    isConnecting,
    isCorrectNetwork,
    networkChainId,
    expectedChainId,
    switchToExpectedNetwork,
  } = useWallet();

  const [customerBusy, setCustomerBusy] = useState(false);
  const [merchantBusy, setMerchantBusy] = useState(false);

  const handleCustomerConnect = async () => {
    if (customerBusy) return;
    setCustomerBusy(true);
    try {
      await connectCustomerWallet();
      toast.success('Customer wallet connected');
    } catch (error) {
      console.error('Customer wallet connection failed:', error);
      toast.error(error?.message || 'Failed to connect customer wallet');
    } finally {
      setCustomerBusy(false);
    }
  };

  const handleMerchantConnect = async () => {
    if (merchantBusy) return;
    setMerchantBusy(true);
    try {
      await connectMerchantWallet();
      toast.success('Merchant wallet connected');
    } catch (error) {
      console.error('Merchant wallet connection failed:', error);
      toast.error(error?.message || 'Failed to connect merchant wallet');
    } finally {
      setMerchantBusy(false);
    }
  };

  const handleCustomerDisconnect = () => {
    disconnectCustomerWallet();
    toast.info('Customer wallet disconnected');
  };

  const handleMerchantDisconnect = () => {
    disconnectMerchantWallet();
    toast.info('Merchant wallet disconnected');
  };

  const showNetworkWarning = !isCorrectNetwork && (customerAddress || merchantAddress);

  return (
    <div className="flex flex-col items-end gap-3">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <button
            onClick={handleCustomerConnect}
            disabled={isConnecting || customerBusy}
            className="rounded-full bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 px-5 py-2 text-xs font-semibold uppercase tracking-wider text-white shadow-lg shadow-indigo-500/40 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {customerBusy || isConnecting
              ? 'Connecting Customer...'
              : customerAddress
              ? 'Reconnect Customer'
              : 'Connect Customer Wallet'}
          </button>
          {customerAddress ? (
            <div className="flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-4 py-1 text-xs text-emerald-200">
              <span className="font-semibold uppercase tracking-[0.28em]">Customer</span>
              <span className="font-mono text-sm text-emerald-100">{shortenAddress(customerAddress)}</span>
              <span className="text-[10px] uppercase tracking-[0.4em] text-emerald-200/80">
                {formatBalance(customerBalance)} ETH
              </span>
              <button
                onClick={handleCustomerDisconnect}
                className="rounded-full border border-emerald-200/40 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.4em] text-emerald-200 transition hover:border-red-300 hover:text-red-200"
              >
                Disconnect
              </button>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleMerchantConnect}
            disabled={isConnecting || merchantBusy}
            className="rounded-full bg-gradient-to-br from-emerald-400 via-teal-400 to-cyan-500 px-5 py-2 text-xs font-semibold uppercase tracking-wider text-slate-900 shadow-lg shadow-emerald-400/40 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {merchantBusy || isConnecting
              ? 'Connecting Merchant...'
              : merchantAddress
              ? 'Reconnect Merchant'
              : 'Connect Merchant Wallet'}
          </button>
          {merchantAddress ? (
            <div className="flex items-center gap-2 rounded-full border border-cyan-400/50 bg-cyan-400/15 px-4 py-1 text-xs text-cyan-100">
              <span className="font-semibold uppercase tracking-[0.28em]">Merchant</span>
              <span className="font-mono text-sm text-cyan-50">{shortenAddress(merchantAddress)}</span>
              <span className="text-[10px] uppercase tracking-[0.4em] text-cyan-100/80">
                {formatBalance(merchantBalance)} ETH
              </span>
              <button
                onClick={handleMerchantDisconnect}
                className="rounded-full border border-cyan-200/40 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.4em] text-cyan-100 transition hover:border-red-300 hover:text-red-200"
              >
                Disconnect
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {showNetworkWarning ? (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-2 text-xs text-amber-100">
          <span>
            Wrong network ({networkChainId ?? 'unknown'}). Switch to Hardhat Localhost (
            {expectedChainId}).
          </span>
          <button
            onClick={() =>
              switchToExpectedNetwork().catch((error) => {
                console.error('Network switch failed:', error);
                toast.error(error?.message || 'Unable to switch network automatically');
              })
            }
            className="rounded-full border border-amber-200/40 px-3 py-1 font-semibold uppercase tracking-widest text-amber-100 transition hover:border-amber-200 hover:text-white"
          >
            Switch
          </button>
        </div>
      ) : null}
    </div>
  );
}


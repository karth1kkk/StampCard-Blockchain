import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { useWallet } from '../context/WalletContext';
import { stampCardChain } from '../lib/wagmiConfig';

const shortenAddress = (address) => `${address.slice(0, 6)}...${address.slice(-4)}`;

export default function WalletConnect() {
  const {
    account,
    connectors,
    connect,
    disconnect,
    isConnecting,
    isDisconnecting,
    isCorrectNetwork,
    switchToExpectedNetwork,
  } = useWallet();
  const [selectedConnectorId, setSelectedConnectorId] = useState(null);
  const [isWorking, setIsWorking] = useState(false);

  useEffect(() => {
    if (connectors?.length && !selectedConnectorId) {
      setSelectedConnectorId(connectors[0].id);
    }
  }, [connectors, selectedConnectorId]);

  const handleConnect = async () => {
    if (!selectedConnectorId) {
      toast.error('No wallet connectors available.');
      return;
    }

    setIsWorking(true);
    try {
      await connect(selectedConnectorId);
      toast.success('Wallet connected successfully');
    } catch (error) {
      console.error('Wallet connection failed:', error);
      toast.error(error?.shortMessage || error?.message || 'Failed to connect wallet');
    } finally {
      setIsWorking(false);
    }
  };

  const handleDisconnect = async () => {
    setIsWorking(true);
    try {
      await disconnect();
      toast.info('Wallet disconnected');
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
      toast.error(error?.message || 'Could not disconnect wallet');
    } finally {
      setIsWorking(false);
    }
  };

  const handleSwitchNetwork = async () => {
    try {
      await switchToExpectedNetwork();
      toast.success(`Switched to ${stampCardChain.name}`);
    } catch (error) {
      console.error('Failed to switch network:', error);
      toast.error(error?.shortMessage || error?.message || 'Network switch rejected');
    }
  };

  if (account) {
    return (
      <div className="flex flex-col items-end gap-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 text-xs font-medium text-emerald-200 backdrop-blur">
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.7)]" />
            <span className="uppercase tracking-[0.28em] text-emerald-300">Active</span>
          </div>
          <div className="rounded-full bg-white/5 px-4 py-2 font-mono text-sm text-white/80 ring-1 ring-white/10">
            {shortenAddress(account)}
          </div>
          <button
            onClick={handleDisconnect}
            disabled={isDisconnecting || isWorking}
            className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white/80 transition hover:border-red-400/60 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDisconnecting || isWorking ? 'Disconnecting...' : 'Disconnect'}
          </button>
        </div>
        {!isCorrectNetwork ? (
          <div className="flex items-center gap-3 rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-2 text-xs text-amber-100">
            <span>
              Wrong network. Switch to <span className="font-semibold">{stampCardChain.name}</span>
            </span>
            <button
              onClick={handleSwitchNetwork}
              className="rounded-full border border-amber-200/40 px-3 py-1 font-semibold uppercase tracking-widest text-amber-100 transition hover:border-amber-200 hover:text-white"
            >
              Switch
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {connectors?.length > 1 ? (
        <select
          value={selectedConnectorId || ''}
          onChange={(event) => setSelectedConnectorId(event.target.value)}
          className="rounded-full border border-white/20 bg-black/30 px-3 py-2 text-xs text-white/80 outline-none transition focus:border-blue-400/60 focus:ring-2 focus:ring-blue-400/30"
        >
          {connectors.map((connector) => (
            <option key={connector.id} value={connector.id} disabled={!connector.ready}>
              {connector.name}
            </option>
          ))}
        </select>
      ) : null}
      <button
        onClick={handleConnect}
        disabled={isConnecting || isWorking}
        className="rounded-full bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/40 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isConnecting || isWorking ? 'Connecting...' : 'Connect Wallet'}
      </button>
    </div>
  );
}


import { useState, useEffect } from 'react';
import { useWallet } from '../context/WalletContext';
import { getTransactionHistory } from '../lib/web3';

export default function TransactionHistory() {
  const { account, provider } = useWallet();
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (account && provider) {
      loadHistory();
    }
  }, [account, provider]);

  const loadHistory = async () => {
    if (!account || !provider) return;
    
    setIsLoading(true);
    try {
      const history = await getTransactionHistory(account, provider);
      setTransactions(history);
    } catch (error) {
      console.error('Error loading transaction history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getTransactionTypeLabel = (type) => {
    switch (type) {
      case 'stamp_issued':
        return 'Stamp Issued';
      case 'reward_granted':
        return 'Reward Granted';
      case 'reward_redeemed':
        return 'Reward Redeemed';
      default:
        return type;
    }
  };

  const getTransactionTypeColor = (type) => {
    switch (type) {
      case 'stamp_issued':
      return 'bg-blue-500/10 text-blue-200 ring-1 ring-blue-400/30';
      case 'reward_granted':
      return 'bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-400/30';
      case 'reward_redeemed':
      return 'bg-purple-500/10 text-purple-200 ring-1 ring-purple-400/30';
      default:
      return 'bg-slate-500/10 text-slate-200 ring-1 ring-slate-400/30';
    }
  };

  if (!account) {
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
          <p className="text-xs uppercase tracking-[0.4em] text-indigo-200">On-Chain Log</p>
          <h2 className="text-3xl font-semibold text-white sm:text-4xl">Transaction History</h2>
        </div>
        <button
          onClick={loadHistory}
          className="inline-flex items-center justify-center rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white/80 transition hover:border-white/40 hover:text-white"
        >
          Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-slate-300">Loading transactions...</div>
      ) : transactions.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-12 text-center text-slate-300 shadow-xl shadow-indigo-900/40 backdrop-blur-2xl">
          No transactions found.
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] shadow-2xl shadow-indigo-900/40 backdrop-blur-2xl">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/5">
              <thead className="bg-white/5">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
                    Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
                    Block
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
                    Transaction Hash
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-transparent">
                {transactions.map((tx, index) => (
                  <tr key={index} className="transition hover:bg-white/5">
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-widest ${getTransactionTypeColor(tx.type)}`}>
                        {getTransactionTypeLabel(tx.type)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-200">
                      {tx.type === 'stamp_issued' && `Stamps: ${tx.stampCount}`}
                      {tx.type === 'reward_granted' && `Rewards: ${tx.rewardCount}`}
                      {tx.type === 'reward_redeemed' && `Remaining: ${tx.remainingRewards}`}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-400">
                      {tx.blockNumber}
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-blue-300">
                      <a
                        href={`https://etherscan.io/tx/${tx.transactionHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-blue-300 underline decoration-dotted underline-offset-4 transition hover:text-blue-100"
                      >
                        {tx.transactionHash.slice(0, 10)}...
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}


import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { BREW_TOKEN_SYMBOL } from '../../lib/constants';

const formatDate = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleString();
};

const formatAmount = (value) => {
  const amount = Number(value || 0);
  if (Number.isNaN(amount)) return '0.00';
  return amount.toFixed(2);
};

const shortenAddress = (value) => (value ? `${value.slice(0, 6)}…${value.slice(-4)}` : '—');
const shortenTxHash = (value) => (value ? `${value.slice(0, 10)}…${value.slice(-8)}` : '—');

export default function PurchaseHistory({ accessToken, refreshToken, onReceiptClick }) {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchPurchases = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all purchases (no address filter for POS view)
      const response = await fetch('/api/transactions');
      if (!response.ok) {
        throw new Error((await response.json())?.error || 'Unable to load purchase history');
      }
      const payload = await response.json();
      setPurchases(payload.purchases || []);
    } catch (error) {
      console.error('Purchase history error:', error);
      toast.error(error?.message || 'Unable to load purchase history');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPurchases();
  }, [fetchPurchases, refreshToken]);

  const totalStats = purchases.reduce(
    (acc, purchase) => {
      const amount = Number(purchase.price_bwt || purchase.total_bwt || 0);
      acc.totalAmount += amount;
      acc.totalCount += 1;
      return acc;
    },
    { totalAmount: 0, totalCount: 0 }
  );

  return (
    <section className="mt-12 rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl shadow-indigo-900/30 backdrop-blur-2xl">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-white/50">Order History</p>
          <h3 className="text-2xl font-semibold text-white">Purchase History</h3>
          <p className="mt-1 text-sm text-slate-300">
            View all purchase transactions and order details from the POS system. Click on any purchase row to view the receipt.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={fetchPurchases}
            disabled={loading}
            className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <div className="rounded-full border border-blue-400/40 bg-blue-400/10 px-4 py-2 text-xs text-blue-200">
            <span className="uppercase tracking-[0.3em]">Total orders:</span> <span>{totalStats.totalCount}</span>
          </div>
          <div className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 text-xs text-emerald-200">
            <span className="uppercase tracking-[0.3em]">Total volume:</span>{' '}
            <span>{formatAmount(totalStats.totalAmount)} {BREW_TOKEN_SYMBOL}</span>
          </div>
        </div>
      </header>

      {loading && purchases.length === 0 ? (
        <p className="mt-6 text-sm text-slate-300">Loading purchase history…</p>
      ) : purchases.length === 0 ? (
        <p className="mt-6 text-sm text-slate-300">No purchase history yet.</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10 text-sm text-slate-200">
            <caption className="pb-4 text-left text-xs uppercase tracking-[0.3em] text-white/40">
              Showing {purchases.length} purchase{purchases.length !== 1 ? 's' : ''} · Total volume:{' '}
              {formatAmount(totalStats.totalAmount)} {BREW_TOKEN_SYMBOL} · Click any row to view receipt
            </caption>
            <thead>
              <tr className="text-left text-xs uppercase tracking-[0.3em] text-white/50">
                <th className="px-4 py-2">Date & Time</th>
                <th className="px-4 py-2">Customer</th>
                <th className="px-4 py-2">Product</th>
                <th className="px-4 py-2">Items</th>
                <th className="px-4 py-2">Amount</th>
                <th className="px-4 py-2">Transaction</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {purchases.map((purchase) => {
                const wallet = purchase.customer_wallet || purchase.wallet_address;
                // Try to get items from items field, metadata, or create from product_name
                let items = [];
                if (purchase.items && Array.isArray(purchase.items)) {
                  items = purchase.items;
                } else if (purchase.metadata && purchase.metadata.items && Array.isArray(purchase.metadata.items)) {
                  items = purchase.metadata.items;
                } else if (purchase.product_name) {
                  // If no items array, create a single item from product_name
                  items = [
                    {
                      name: purchase.product_name,
                      quantity: 1,
                      price: purchase.price_bwt || purchase.total_bwt || 0,
                    },
                  ];
                }
                const productName = items.length > 0 ? items.map((i) => i.name || i.product_name).join(', ') : purchase.product_name || 'Coffee Purchase';
                const amount = purchase.total_bwt || purchase.price_bwt || 0;
                const txHash = purchase.tx_hash;
                const status = purchase.status || 'PAID';
                const createdAt = purchase.created_at;
                const email = purchase.email;

                const handleRowClick = () => {
                  if (onReceiptClick) {
                    // Format purchase data for receipt
                    const receiptData = {
                      items: items,
                      totalBWT: amount,
                      customerWallet: wallet,
                      customerEmail: email || null,
                      merchantEmail: purchase.merchant_email || null,
                      txHash: txHash || null,
                      blockNumber: purchase.block_number || null,
                      timestamp: createdAt || new Date().toISOString(),
                      paymentMethod: purchase.metadata?.paymentMethod || 
                                   (purchase.metadata?.source === 'pos-dashboard' ? 'connected-wallet' : 
                                    purchase.metadata?.source === 'qr-code' ? 'qr-code' : 'unknown'),
                      stampsAwarded: purchase.metadata?.stampsAwarded || 
                                   (purchase.stamps_awarded !== undefined ? Number(purchase.stamps_awarded) : 1),
                      stampCount: purchase.metadata?.stampCount || 
                                purchase.metadata?.stamp_count || 
                                (purchase.stamp_count !== undefined ? Number(purchase.stamp_count) : 0),
                      pendingRewards: purchase.metadata?.pendingRewards || 
                                    purchase.metadata?.pending_rewards || 
                                    (purchase.pending_rewards !== undefined ? Number(purchase.pending_rewards) : 0),
                    };
                    onReceiptClick(receiptData);
                  }
                };

                return (
                  <tr
                    key={purchase.id || `${wallet}-${createdAt}-${txHash}`}
                    onClick={handleRowClick}
                    className="cursor-pointer transition hover:bg-white/5 active:bg-white/10"
                  >
                    <td className="px-4 py-3 text-xs text-slate-300">{formatDate(createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className="font-mono text-xs text-slate-100">{shortenAddress(wallet)}</span>
                        {email && <span className="text-[10px] text-slate-400">{email}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-white">{productName}</span>
                        {items && items.length > 0 && (
                          <span className="text-[10px] text-slate-400">
                            {items.length} item{items.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {items && items.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {items.slice(0, 2).map((item, idx) => (
                            <span key={idx} className="text-xs text-slate-300">
                              {item.quantity}x {item.name || item.product_name || 'Item'}
                            </span>
                          ))}
                          {items.length > 2 && (
                            <span className="text-[10px] text-slate-400">+{items.length - 2} more</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-emerald-200">
                        {formatAmount(amount)} {BREW_TOKEN_SYMBOL}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {txHash ? (
                        <span className="font-mono text-[10px] text-blue-300">{shortenTxHash(txHash)}</span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] ${
                          status === 'PAID'
                            ? 'bg-emerald-400/10 text-emerald-200'
                            : status === 'PENDING'
                            ? 'bg-yellow-400/10 text-yellow-200'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {status}
                      </span>
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


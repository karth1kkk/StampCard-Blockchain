import { useMemo, useCallback, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BREW_TOKEN_SYMBOL } from '../../lib/constants';

const formatDate = (value) => {
  if (!value) return new Date().toLocaleString();
  return new Date(value).toLocaleString();
};

const formatAmount = (value) => {
  const amount = Number(value || 0);
  if (Number.isNaN(amount)) return '0.00';
  return amount.toFixed(2);
};

const shortenAddress = (value) => (value ? `${value.slice(0, 6)}…${value.slice(-4)}` : '—');
const shortenTxHash = (value) => (value ? `${value.slice(0, 10)}…${value.slice(-8)}` : '—');

export default function ReceiptModal({ isOpen, onClose, receiptData }) {
  const [coffeeMenu, setCoffeeMenu] = useState([]);

  // Fetch products from database
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch('/api/products');
        if (!response.ok) {
          throw new Error('Failed to fetch products');
        }
        const data = await response.json();
        setCoffeeMenu(data.products || []);
      } catch (error) {
        console.error('Error fetching products:', error);
        // Don't show error toast for ReceiptModal as it's non-critical
      }
    };

    fetchProducts();
  }, []);

  const receiptPayload = useMemo(() => {
    if (!receiptData) return null;
    
    const { items, totalBWT, customerWallet, txHash, blockNumber, timestamp, customerEmail, merchantEmail, paymentMethod } = receiptData;
    
    return {
      transaction: {
        txHash: txHash || '—',
        blockNumber: blockNumber || '—',
        timestamp: timestamp || new Date().toISOString(),
        paymentMethod: paymentMethod || 'connected-wallet',
      },
      customer: {
        wallet: customerWallet || '—',
        email: customerEmail || null,
      },
      merchant: {
        email: merchantEmail || null,
      },
      items: items || [],
      total: totalBWT || 0,
      subtotal: totalBWT || 0,
      tax: 0,
      stampsAwarded: receiptData.stampsAwarded || 1,
      stampCount: receiptData.stampCount || 0,
      pendingRewards: receiptData.pendingRewards || 0,
    };
  }, [receiptData]);

  const handleDownloadReceipt = useCallback(() => {
    if (!receiptPayload) return;

    const subtotal = receiptPayload.subtotal;
    const tax = receiptPayload.tax;
    const total = receiptPayload.total;

    // Generate receipt content
    const receiptContent = [
      '═══════════════════════════════════════════════════════',
      '              BREWTOKEN COFFEE LOYALTY',
      '                    RECEIPT',
      '═══════════════════════════════════════════════════════',
      '',
      `Date & Time: ${formatDate(receiptPayload.transaction.timestamp)}`,
      `Transaction Hash: ${receiptPayload.transaction.txHash}`,
      receiptPayload.transaction.blockNumber !== '—' 
        ? `Block Number: #${receiptPayload.transaction.blockNumber}`
        : '',
      `Payment Method: ${receiptPayload.transaction.paymentMethod.replace(/-/g, ' ').toUpperCase()}`,
      '',
      '───────────────────────────────────────────────────────',
      'CUSTOMER INFORMATION',
      '───────────────────────────────────────────────────────',
      `Wallet: ${receiptPayload.customer.wallet}`,
      receiptPayload.customer.email ? `Email: ${receiptPayload.customer.email}` : '',
      receiptPayload.merchant.email ? `Merchant: ${receiptPayload.merchant.email}` : '',
      '',
      '───────────────────────────────────────────────────────',
      'ITEMS PURCHASED',
      '───────────────────────────────────────────────────────',
      ...receiptPayload.items.map((item, idx) => {
        const productId = item.id || item.product_id;
        const fullProduct = productId ? coffeeMenu.find((p) => p.id === productId) : null;
        const itemName = item.name || item.product_name || fullProduct?.name || 'Coffee';
        const itemDescription = item.description || fullProduct?.description || null;
        const itemPrice = item.price || item.price_bwt || fullProduct?.price || 0;
        const itemQuantity = item.quantity || 1;
        const itemTotal = Number(itemPrice) * Number(itemQuantity);
        
        return [
          `${itemName}`,
          itemDescription ? `  ${itemDescription}` : '',
          `  Qty: ${itemQuantity} × ${formatAmount(itemPrice)} ${BREW_TOKEN_SYMBOL}`,
          `  Total: ${formatAmount(itemTotal)} ${BREW_TOKEN_SYMBOL}`,
          '',
        ].filter(Boolean);
      }).flat(),
      '───────────────────────────────────────────────────────',
      'TOTALS',
      '───────────────────────────────────────────────────────',
      `Subtotal: ${formatAmount(subtotal)} ${BREW_TOKEN_SYMBOL}`,
      tax > 0 ? `Tax: ${formatAmount(tax)} ${BREW_TOKEN_SYMBOL}` : '',
      `TOTAL: ${formatAmount(total)} ${BREW_TOKEN_SYMBOL}`,
      '',
      '───────────────────────────────────────────────────────',
      'LOYALTY REWARDS',
      '───────────────────────────────────────────────────────',
      `Stamps Awarded: ${receiptPayload.stampsAwarded}`,
      `Total Stamps: ${receiptPayload.stampCount}`,
      receiptPayload.pendingRewards > 0 
        ? `Pending Rewards: ${receiptPayload.pendingRewards} free drink${receiptPayload.pendingRewards !== 1 ? 's' : ''}`
        : '',
      '',
      '───────────────────────────────────────────────────────',
      'TRANSACTION DETAILS',
      '───────────────────────────────────────────────────────',
      JSON.stringify(
        {
          transactionHash: receiptPayload.transaction.txHash,
          blockNumber: receiptPayload.transaction.blockNumber,
          timestamp: receiptPayload.transaction.timestamp,
          paymentMethod: receiptPayload.transaction.paymentMethod,
          customer: {
            wallet: receiptPayload.customer.wallet,
            email: receiptPayload.customer.email || null,
          },
          merchant: {
            email: receiptPayload.merchant.email || null,
          },
          items: receiptPayload.items.map((item) => {
            const productId = item.id || item.product_id;
            const fullProduct = productId ? coffeeMenu.find((p) => p.id === productId) : null;
            return {
              id: productId || null,
              name: item.name || item.product_name || fullProduct?.name || 'Coffee',
              description: item.description || fullProduct?.description || null,
              quantity: item.quantity || 1,
              price: item.price || item.price_bwt || fullProduct?.price || 0,
              total: (item.price || item.price_bwt || fullProduct?.price || 0) * (item.quantity || 1),
            };
          }),
          totals: {
            subtotal: receiptPayload.subtotal,
            tax: receiptPayload.tax,
            total: receiptPayload.total,
          },
          loyalty: {
            stampsAwarded: receiptPayload.stampsAwarded,
            stampCount: receiptPayload.stampCount,
            pendingRewards: receiptPayload.pendingRewards,
          },
        },
        null,
        2
      ),
      '',
      '═══════════════════════════════════════════════════════',
      'Thank you for your purchase!',
      'This receipt is stored on-chain and in our database.',
      '═══════════════════════════════════════════════════════',
    ].filter(Boolean).join('\n');

    // Create a blob and download
    const blob = new Blob([receiptContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    // Generate filename with timestamp and tx hash
    const timestamp = new Date(receiptPayload.transaction.timestamp).toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const txHashShort = receiptPayload.transaction.txHash.slice(0, 10);
    link.download = `receipt-${timestamp}-${txHashShort}.txt`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [receiptPayload]);

  if (!isOpen || !receiptPayload) {
    return null;
  }

  const subtotal = receiptPayload.subtotal;
  const tax = receiptPayload.tax;
  const total = receiptPayload.total;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 px-4 py-6 backdrop-blur"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="relative w-full max-w-2xl rounded-3xl border border-white/10 bg-white shadow-2xl shadow-black/50 overflow-hidden"
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Receipt Header */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-black px-8 py-6 border-b border-white/10">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white">Receipt</h2>
                  <p className="text-xs text-slate-400 mt-1">BrewToken Coffee Loyalty</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadReceipt}
                    className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-200 transition hover:border-emerald-300 hover:bg-emerald-400/20 flex items-center gap-2"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    Download
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-white/80 transition hover:border-white/40 hover:text-white"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>

            {/* Receipt Body */}
            <div className="bg-white p-8 text-slate-900 max-h-[80vh] overflow-y-auto">
              {/* Receipt Info */}
              <div className="mb-6 pb-4 border-b-2 border-slate-300">
                <div className="grid grid-cols-2 gap-4 text-xs mb-4">
                  <div>
                    <p className="text-slate-500 uppercase tracking-[0.2em] mb-1 text-[10px]">Date & Time</p>
                    <p className="font-semibold text-sm">{formatDate(receiptPayload.transaction.timestamp)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 uppercase tracking-[0.2em] mb-1 text-[10px]">Transaction Hash</p>
                    <p className="font-mono text-xs break-all">{receiptPayload.transaction.txHash}</p>
                  </div>
                  {receiptPayload.transaction.blockNumber !== '—' && (
                    <div>
                      <p className="text-slate-500 uppercase tracking-[0.2em] mb-1 text-[10px]">Block Number</p>
                      <p className="font-semibold text-sm">#{receiptPayload.transaction.blockNumber}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-slate-500 uppercase tracking-[0.2em] mb-1 text-[10px]">Payment Method</p>
                    <p className="font-semibold text-sm capitalize">{receiptPayload.transaction.paymentMethod.replace(/-/g, ' ')}</p>
                  </div>
                </div>
              </div>

              {/* Customer & Merchant Info */}
              <div className="mb-6 pb-4 border-b border-slate-200">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-[0.2em] mb-2">Customer</p>
                    <p className="font-mono text-sm text-slate-900 break-all">{receiptPayload.customer.wallet}</p>
                    {receiptPayload.customer.email && (
                      <p className="text-xs text-slate-600 mt-1">{receiptPayload.customer.email}</p>
                    )}
                  </div>
                  {receiptPayload.merchant.email && (
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-[0.2em] mb-2">Merchant</p>
                      <p className="text-sm text-slate-900">{receiptPayload.merchant.email}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Items */}
              <div className="mb-6">
                <p className="text-xs text-slate-500 uppercase tracking-[0.2em] mb-3">Items Purchased</p>
                <div className="space-y-3">
                  {receiptPayload.items.map((item, idx) => {
                    // Try to get full product details from COFFEE_MENU
                    const productId = item.id || item.product_id;
                    const fullProduct = productId ? coffeeMenu.find((p) => p.id === productId) : null;
                    const itemName = item.name || item.product_name || fullProduct?.name || 'Coffee';
                    const itemDescription = item.description || fullProduct?.description || null;
                    const itemPrice = item.price || item.price_bwt || fullProduct?.price || 0;
                    const itemQuantity = item.quantity || 1;
                    const itemTotal = Number(itemPrice) * Number(itemQuantity);

                    return (
                      <div key={idx} className="flex items-start justify-between py-3 border-b border-slate-200">
                        <div className="flex-1 pr-4">
                          <div className="flex items-start gap-3">
                            <div className="flex-1">
                              <p className="font-semibold text-base text-slate-900">{itemName}</p>
                              {itemDescription && (
                                <p className="text-xs text-slate-500 mt-1">{itemDescription}</p>
                              )}
                              <p className="text-xs text-slate-400 mt-2">
                                Qty: {itemQuantity} × {formatAmount(itemPrice)} {BREW_TOKEN_SYMBOL}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg text-slate-900">
                            {formatAmount(itemTotal)} {BREW_TOKEN_SYMBOL}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Totals */}
              <div className="mb-6 pb-4 border-t-2 border-slate-300 pt-4">
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Subtotal</span>
                    <span className="font-semibold">{formatAmount(subtotal)} {BREW_TOKEN_SYMBOL}</span>
                  </div>
                  {tax > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Tax</span>
                      <span className="font-semibold">{formatAmount(tax)} {BREW_TOKEN_SYMBOL}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xl font-bold text-slate-900 pt-3 border-t-2 border-slate-300">
                    <span>Total</span>
                    <span>{formatAmount(total)} {BREW_TOKEN_SYMBOL}</span>
                  </div>
                </div>
              </div>

              {/* Loyalty Info */}
              <div className="mb-6 pb-4 border-b border-slate-200 bg-emerald-50 rounded-2xl p-4">
                <p className="text-xs text-emerald-700 uppercase tracking-[0.2em] mb-2 font-semibold">Loyalty Rewards</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-emerald-600">Stamps Awarded</p>
                    <p className="font-bold text-emerald-900">{receiptPayload.stampsAwarded}</p>
                  </div>
                  <div>
                    <p className="text-emerald-600">Total Stamps</p>
                    <p className="font-bold text-emerald-900">{receiptPayload.stampCount}</p>
                  </div>
                  {receiptPayload.pendingRewards > 0 && (
                    <div className="col-span-2">
                      <p className="text-emerald-600">Pending Rewards</p>
                      <p className="font-bold text-emerald-900">{receiptPayload.pendingRewards} free drink{receiptPayload.pendingRewards !== 1 ? 's' : ''}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Transaction Payload */}
              <div className="mb-6">
                <p className="text-xs text-slate-500 uppercase tracking-[0.2em] mb-2 font-semibold">Transaction Payload</p>
                <div className="rounded-lg bg-slate-50 p-4 border border-slate-200 max-h-64 overflow-y-auto">
                  <pre className="text-xs text-slate-700 whitespace-pre-wrap break-words font-mono">
                    {JSON.stringify(
                      {
                        transactionHash: receiptPayload.transaction.txHash,
                        blockNumber: receiptPayload.transaction.blockNumber,
                        timestamp: receiptPayload.transaction.timestamp,
                        paymentMethod: receiptPayload.transaction.paymentMethod,
                        customer: {
                          wallet: receiptPayload.customer.wallet,
                          email: receiptPayload.customer.email || null,
                        },
                        merchant: {
                          email: receiptPayload.merchant.email || null,
                        },
                        items: receiptPayload.items.map((item) => {
                          const productId = item.id || item.product_id;
                          const fullProduct = productId ? coffeeMenu.find((p) => p.id === productId) : null;
                          return {
                            id: productId || null,
                            name: item.name || item.product_name || fullProduct?.name || 'Coffee',
                            description: item.description || fullProduct?.description || null,
                            quantity: item.quantity || 1,
                            price: item.price || item.price_bwt || fullProduct?.price || 0,
                            total: (item.price || item.price_bwt || fullProduct?.price || 0) * (item.quantity || 1),
                          };
                        }),
                        totals: {
                          subtotal: receiptPayload.subtotal,
                          tax: receiptPayload.tax,
                          total: receiptPayload.total,
                        },
                        loyalty: {
                          stampsAwarded: receiptPayload.stampsAwarded,
                          stampCount: receiptPayload.stampCount,
                          pendingRewards: receiptPayload.pendingRewards,
                        },
                      },
                      null,
                      2
                    )}
                  </pre>
                </div>
              </div>

              {/* Footer */}
              <div className="text-center text-xs text-slate-400 pt-4 border-t border-slate-200">
                <p>Thank you for your purchase!</p>
                <p className="mt-1">This receipt is stored on-chain and in our database.</p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}


import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ethers } from 'ethers';
import { toast } from 'react-toastify';
import { BREW_TOKEN_SYMBOL } from '../../lib/constants';
import { transferTokensOnChain, getTokenBalance } from '../../lib/web3';

const LOYALTY_ADDRESS = process.env.NEXT_PUBLIC_LOYALTY_ADDRESS;

const formatAmount = (value) => {
  const amount = Number(value || 0);
  if (Number.isNaN(amount)) return '0.00';
  return amount.toFixed(2);
};

const shortenAddress = (value) => (value ? `${value.slice(0, 6)}…${value.slice(-4)}` : '—');

export default function FundPoolModal({ isOpen, onClose, signer, provider, customerAddress }) {
  const [amount, setAmount] = useState('200');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [balance, setBalance] = useState(null);
  const [error, setError] = useState('');
  const [transferType, setTransferType] = useState('contract'); // 'contract' or 'custom'

  // Set default recipient address when modal opens
  // Default to contract address (reward pool) if available, otherwise use customerAddress
  useEffect(() => {
    if (isOpen) {
      if (transferType === 'contract' && LOYALTY_ADDRESS) {
        setRecipientAddress(LOYALTY_ADDRESS);
      } else if (transferType === 'contract' && customerAddress) {
        setRecipientAddress(customerAddress);
      } else if (transferType === 'custom') {
        setRecipientAddress('');
      }
    }
  }, [isOpen, customerAddress, transferType]);

  // Fetch token balance
  useEffect(() => {
    if (isOpen && signer && provider) {
      const fetchBalance = async () => {
        try {
          const signerAddress = await signer.getAddress();
          const tokenBalance = await getTokenBalance(signerAddress, provider);
          setBalance(tokenBalance);
        } catch (error) {
          console.error('Failed to fetch balance:', error);
          setBalance(null);
        }
      };
      fetchBalance();
    }
  }, [isOpen, signer, provider]);

  const handleTransfer = useCallback(async () => {
    if (!signer) {
      setError('Wallet signer is not available.');
      return;
    }

    if (!recipientAddress || !ethers.isAddress(recipientAddress)) {
      setError('Please enter a valid recipient address.');
      return;
    }

    const amountNum = Number(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid amount greater than zero.');
      return;
    }

    try {
      setIsTransferring(true);
      setError('');

      // Convert amount to wei (18 decimals)
      const amountWei = ethers.parseUnits(amount.toString(), 18);

      // Check balance if available
      if (balance !== null && amountWei > balance) {
        const balanceFormatted = ethers.formatUnits(balance, 18);
        setError(`Insufficient balance. You have ${formatAmount(balanceFormatted)} ${BREW_TOKEN_SYMBOL}, but need ${formatAmount(amount)} ${BREW_TOKEN_SYMBOL}.`);
        setIsTransferring(false);
        return;
      }

      // Execute transfer
      const { hash, receipt } = await transferTokensOnChain(
        { to: recipientAddress, amountWei },
        signer
      );

      // Show success message
      console.log('Transfer tx hash:', hash);
      console.log('Transfer confirmed in block', receipt.blockNumber);

      // Show success toast
      toast.success(`Transfer successful · tx ${hash.slice(0, 10)}…`);

      // Close modal and reset form
      onClose();
      setAmount('200');
      setTransferType('contract');
      if (LOYALTY_ADDRESS) {
        setRecipientAddress(LOYALTY_ADDRESS);
      } else if (customerAddress) {
        setRecipientAddress(customerAddress);
      }
      setError('');
      
      // Refresh balance
      if (signer && provider) {
        try {
          const signerAddress = await signer.getAddress();
          const newBalance = await getTokenBalance(signerAddress, provider);
          setBalance(newBalance);
        } catch (error) {
          console.error('Failed to refresh balance:', error);
        }
      }
    } catch (error) {
      console.error('Transfer failed:', error);
      const errorMessage = error?.message || error?.reason || 'Transfer failed. Please try again.';
      setError(errorMessage);
    } finally {
      setIsTransferring(false);
    }
  }, [signer, recipientAddress, amount, balance, customerAddress, provider, onClose]);

  const handleClose = useCallback(() => {
    if (!isTransferring) {
      setError('');
      setAmount('200');
      setTransferType('contract');
      if (LOYALTY_ADDRESS) {
        setRecipientAddress(LOYALTY_ADDRESS);
      } else if (customerAddress) {
        setRecipientAddress(customerAddress);
      } else {
        setRecipientAddress('');
      }
      onClose();
    }
  }, [isTransferring, customerAddress, onClose]);

  if (!isOpen) {
    return null;
  }

  const balanceFormatted = balance !== null ? formatAmount(ethers.formatUnits(balance, 18)) : '—';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 px-4 py-6 backdrop-blur"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
        >
          <motion.div
            className="relative w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/95 p-8 shadow-2xl shadow-black/50"
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">Transfer BWT Tokens</h2>
                <p className="mt-1 text-xs text-slate-400">
                  Transfer BWT tokens to the contract address or another wallet
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                disabled={isTransferring}
                className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-white/80 transition hover:border-white/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Close
              </button>
            </div>

            <div className="space-y-6">
              {/* Balance Display */}
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-white/50 mb-2">Your Balance</p>
                <p className="text-2xl font-bold text-white">
                  {balanceFormatted} {BREW_TOKEN_SYMBOL}
                </p>
              </div>

              {/* Transfer Type Selection */}
              <div>
                <label className="block text-xs uppercase tracking-[0.3em] text-white/70 mb-3">
                  Transfer To
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setTransferType('contract');
                      if (LOYALTY_ADDRESS) {
                        setRecipientAddress(LOYALTY_ADDRESS);
                      } else if (customerAddress) {
                        setRecipientAddress(customerAddress);
                      }
                      setError('');
                    }}
                    disabled={isTransferring}
                    className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                      transferType === 'contract'
                        ? 'border-emerald-400/50 bg-emerald-400/10 text-emerald-200'
                        : 'border-white/10 bg-black/30 text-white/70 hover:border-white/20'
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    Contract Address
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTransferType('custom');
                      setRecipientAddress('');
                      setError('');
                    }}
                    disabled={isTransferring}
                    className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                      transferType === 'custom'
                        ? 'border-emerald-400/50 bg-emerald-400/10 text-emerald-200'
                        : 'border-white/10 bg-black/30 text-white/70 hover:border-white/20'
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    Custom Address
                  </button>
                </div>
              </div>

              {/* Recipient Address */}
              <div>
                <label htmlFor="recipient-address" className="block text-xs uppercase tracking-[0.3em] text-white/70 mb-2">
                  {transferType === 'contract' ? 'Contract Address (Reward Pool)' : 'Recipient Wallet Address'}
                </label>
                <input
                  id="recipient-address"
                  type="text"
                  value={recipientAddress}
                  onChange={(e) => {
                    setRecipientAddress(e.target.value);
                    setError('');
                  }}
                  placeholder={transferType === 'contract' ? (LOYALTY_ADDRESS || "0x...") : "Enter wallet address (0x...)"}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 font-mono text-sm text-white placeholder:text-white/30 focus:border-emerald-400/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                  disabled={isTransferring || transferType === 'contract'}
                />
                {transferType === 'contract' && LOYALTY_ADDRESS && recipientAddress.toLowerCase() === LOYALTY_ADDRESS.toLowerCase() && (
                  <p className="mt-2 text-xs text-emerald-300">
                    ✓ This will fund the reward pool. The contract needs BWT to pay rewards to customers.
                  </p>
                )}
                {transferType === 'custom' && recipientAddress && ethers.isAddress(recipientAddress) && (
                  <p className="mt-2 text-xs text-emerald-300">
                    ✓ Valid wallet address
                  </p>
                )}
                {transferType === 'custom' && recipientAddress && !ethers.isAddress(recipientAddress) && (
                  <p className="mt-2 text-xs text-red-300">
                    ⚠ Invalid wallet address format
                  </p>
                )}
              </div>

              {/* Amount */}
              <div>
                <label htmlFor="amount" className="block text-xs uppercase tracking-[0.3em] text-white/70 mb-2">
                  Amount ({BREW_TOKEN_SYMBOL})
                </label>
                <input
                  id="amount"
                  type="number"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setError('');
                  }}
                  placeholder="200"
                  min="0"
                  step="0.01"
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-emerald-400/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                  disabled={isTransferring}
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="rounded-xl border border-red-400/30 bg-red-400/10 p-3">
                  <p className="text-xs text-red-200">{error}</p>
                </div>
              )}

              {/* Transfer Button */}
              <button
                type="button"
                onClick={handleTransfer}
                disabled={isTransferring || !amount || !recipientAddress}
                className="w-full rounded-full bg-gradient-to-r from-emerald-400 via-lime-300 to-sky-300 px-6 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-slate-900 shadow-lg shadow-emerald-300/40 transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isTransferring ? 'Transferring…' : `Transfer ${amount || '0'} ${BREW_TOKEN_SYMBOL}`}
              </button>

              {/* Info */}
              <p className="text-xs text-center text-slate-400">
                {transferType === 'contract' && LOYALTY_ADDRESS && recipientAddress.toLowerCase() === LOYALTY_ADDRESS.toLowerCase()
                  ? 'This will transfer BWT tokens from your wallet to the contract to fund the reward pool. Customers can then redeem rewards.'
                  : transferType === 'contract'
                  ? 'This will transfer BWT tokens to the contract address to fund the reward pool.'
                  : 'This will transfer BWT tokens from your connected wallet to the specified recipient address.'}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}


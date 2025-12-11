import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const VOUCHER_OPTIONS = [
  {
    id: 'flat-white',
    name: 'Flat White',
    description: 'Smooth espresso with steamed milk',
  },
  {
    id: 'cappuccino',
    name: 'Cappuccino',
    description: 'Espresso with foamed milk',
  },
];

export default function VoucherSelectionModal({ isOpen, onClose, onSelect }) {
  const [selectedVoucher, setSelectedVoucher] = useState(null);

  const handleConfirm = () => {
    if (selectedVoucher) {
      onSelect(selectedVoucher);
      setSelectedVoucher(null);
      onClose();
    }
  };

  if (!isOpen) {
    return null;
  }

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
            className="relative w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/95 p-8 shadow-2xl shadow-black/50"
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">Select Your Free Drink</h2>
                <p className="mt-1 text-xs text-slate-400">
                  Choose your reward: Flat White or Cappuccino
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-white/80 transition hover:border-white/40 hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="space-y-3 mb-6">
              {VOUCHER_OPTIONS.map((voucher) => (
                <button
                  key={voucher.id}
                  type="button"
                  onClick={() => setSelectedVoucher(voucher)}
                  className={`w-full rounded-2xl border-2 p-4 text-left transition ${
                    selectedVoucher?.id === voucher.id
                      ? 'border-emerald-400 bg-emerald-400/10'
                      : 'border-white/10 bg-white/5 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-white">{voucher.name}</h3>
                      <p className="mt-1 text-xs text-slate-400">{voucher.description}</p>
                    </div>
                    {selectedVoucher?.id === voucher.id && (
                      <div className="rounded-full bg-emerald-400 p-1">
                        <svg
                          className="h-5 w-5 text-white"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-full border border-white/20 px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/40 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!selectedVoucher}
                className="flex-1 rounded-full bg-gradient-to-r from-emerald-400 to-sky-400 px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-slate-900 shadow-lg shadow-emerald-300/40 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Confirm Selection
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}



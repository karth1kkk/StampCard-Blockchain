import { useEffect, useMemo } from 'react';
import QRCode from 'react-qr-code';

export default function QRModal({ isOpen, onClose, payload, totalBwt, customerWallet }) {
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') {
      return () => {};
    }
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const qrValue = useMemo(() => payload || '', [payload]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur">
      <div className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-slate-900/90 p-10 shadow-2xl shadow-black/40">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full border border-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-slate-200 transition hover:border-white/40 hover:text-white"
        >
          Close
        </button>
        <div className="space-y-4 text-center">
          <p className="text-xs uppercase tracking-[0.42em] text-white/40">Scan to Pay</p>
          <h2 className="text-2xl font-semibold text-white">BWT Payment Request</h2>
          <div className="mx-auto w-fit rounded-3xl border border-white/10 bg-white p-6 shadow-inner shadow-black/20">
            <QRCode value={qrValue} size={220} />
          </div>
          <p className="text-sm text-slate-300">
            Ask the customer to scan this QR with MetaMask Mobile. They will approve a BrewToken transfer for{' '}
            <span className="font-semibold text-white">{totalBwt} BWT</span>.
          </p>
          {customerWallet ? (
            <p className="text-xs font-mono text-slate-400">
              Customer wallet: <span className="text-slate-200">{customerWallet}</span>
            </p>
          ) : null}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left text-xs text-slate-200">
            <p className="font-semibold uppercase tracking-[0.3em] text-white/60">Instructions</p>
            <ol className="mt-3 space-y-2 text-sm text-slate-200/80">
              <li>1. Customer opens MetaMask Mobile and taps “Scan”.</li>
              <li>2. MetaMask reads this EIP-681 payment request and fills in the BrewToken transfer.</li>
              <li>3. After confirmation, the POS will automatically record 1 stamp for the customer.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}



import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import QRCode from 'qrcode';
import { toast } from 'react-toastify';
import { useWallet } from '../context/WalletContext';

const DEFAULT_AMOUNT = '0.10';

const buildPayload = (merchantAddress, amount, chainId) => ({
  to: merchantAddress,
  value: amount || '0',
  chainId,
});

export default function ConnectViaQR() {
  const { merchantAddress, expectedChainId } = useWallet();
  const [amount, setAmount] = useState(DEFAULT_AMOUNT);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const payload = useMemo(() => {
    if (!merchantAddress) return null;
    return buildPayload(merchantAddress, amount, expectedChainId);
  }, [merchantAddress, amount, expectedChainId]);

  useEffect(() => {
    if (!payload) {
      setQrDataUrl('');
      return;
    }

    let ignore = false;
    const generate = async () => {
      try {
        setIsGenerating(true);
        const dataUrl = await QRCode.toDataURL(JSON.stringify(payload), {
          width: 240,
          margin: 2,
          color: {
            dark: '#0f172a',
            light: '#F8FAFC',
          },
        });
        if (!ignore) {
          setQrDataUrl(dataUrl);
        }
      } catch (error) {
        console.error('Connect via QR generation failed:', error);
        if (!ignore) {
          setQrDataUrl('');
        }
      } finally {
        if (!ignore) {
          setIsGenerating(false);
        }
      }
    };

    generate();

    return () => {
      ignore = true;
    };
  }, [payload]);

  const handleCopyPayload = async () => {
    if (!payload) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      toast.success('QR payload copied to clipboard');
    } catch (error) {
      console.error('Failed to copy connect payload:', error);
      toast.error('Unable to copy QR payload');
    }
  };

  if (!merchantAddress) {
    return null;
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl shadow-indigo-900/40 backdrop-blur-2xl sm:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-2xl font-semibold text-white">Connect via QR</h3>
          <p className="mt-2 text-sm text-slate-300">
            Share this QR with customers using mobile wallets. It encodes the merchant address, an
            amount, and the Hardhat chain id so they can connect on the same network.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 rounded-full border border-white/15 bg-black/30 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/70">
            Amount
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.10"
              className="w-20 rounded-full border border-white/10 bg-black/60 px-2 py-1 text-xs font-mono text-white/80 outline-none focus:border-emerald-400/60 focus:ring-1 focus:ring-emerald-300/40"
            />
          </label>
          <button
            onClick={handleCopyPayload}
            className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/80 transition hover:border-white/40 hover:text-white"
            type="button"
          >
            Copy Payload
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[0.45fr_0.55fr]">
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-white/10 bg-black/30 p-6 shadow-inner shadow-blue-900/30">
          {qrDataUrl ? (
            <Image
              src={qrDataUrl}
              alt="Connect via QR"
              width={192}
              height={192}
              unoptimized
              className="rounded-2xl border border-white/10 bg-white/10 p-3 shadow-[0_35px_120px_-45px_rgba(59,130,246,0.8)]"
            />
          ) : (
            <div className="flex h-48 w-48 items-center justify-center rounded-2xl border border-dashed border-white/20 text-xs text-slate-400">
              {isGenerating ? 'Generating QR…' : 'Enter an amount to generate a QR code.'}
            </div>
          )}
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/50">
            Chain ID {expectedChainId}
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/20 p-6 text-sm text-slate-200 shadow-inner shadow-indigo-900/20">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
            QR Payload Preview
          </p>
          <pre className="mt-3 max-h-48 overflow-auto rounded-2xl bg-black/40 p-4 text-xs text-emerald-200">
            {payload
              ? JSON.stringify(payload, null, 2)
              : '// Provide an amount to generate the QR payload.'}
          </pre>
          <p className="mt-3 text-xs text-slate-400">
            Customers scan this QR with a mobile wallet to prefill the recipient, amount, and network for transactions on your local Hardhat node.
          </p>
        </div>
      </div>
    </div>
  );
}


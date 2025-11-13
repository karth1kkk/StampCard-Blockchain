import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import QRCode from 'qrcode';
import { toast } from 'react-toastify';
import { useWallet } from '../context/WalletContext';
import { COFFEE_MENU } from '../constants/products';
import { MERCHANT_WALLET_ADDRESS, LOYALTY_CONTRACT_ADDRESS } from '../lib/constants';

const TOKEN_ADDRESS = process.env.NEXT_PUBLIC_TOKEN_ADDRESS || '';
const TOKEN_SYMBOL = 'BWT';

const buildPayload = ({ merchantAddress, chainId, amount, product }) => ({
  type: 'BWT_PURCHASE',
  to: merchantAddress,
  amount: amount || '0',
  chainId,
  tokenAddress: TOKEN_ADDRESS,
  tokenSymbol: TOKEN_SYMBOL,
  decimals: 18,
  product,
});

export default function ConnectViaQR() {
  const { merchantAddress, expectedChainId } = useWallet();
  const [selectedProductId, setSelectedProductId] = useState(COFFEE_MENU[0]?.id || null);
  const [customAmount, setCustomAmount] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const selectedProduct = useMemo(
    () => COFFEE_MENU.find((item) => item.id === selectedProductId) || null,
    [selectedProductId]
  );

  const amountToUse = selectedProduct ? selectedProduct.price : customAmount || '0';

  const payload = useMemo(() => {
    const contractRecipient =
      MERCHANT_WALLET_ADDRESS ||
      LOYALTY_CONTRACT_ADDRESS ||
      merchantAddress;
    if (!contractRecipient) return null;
    return buildPayload({
      merchantAddress: contractRecipient,
      chainId: expectedChainId,
      amount: amountToUse,
      product: selectedProduct
        ? {
            id: selectedProduct.id,
            name: selectedProduct.name,
            description: selectedProduct.description,
            price: selectedProduct.price,
          }
        : undefined,
    });
  }, [merchantAddress, expectedChainId, amountToUse, selectedProduct]);

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
          <h3 className="text-2xl font-semibold text-white">Coffee Menu QR</h3>
          <p className="mt-2 text-sm text-slate-300">
            Pick a drink to generate a QR code. Customers scan it with MetaMask Mobile to pay in {TOKEN_SYMBOL}{' '}
            tokens and automatically receive their stamp during checkout.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:gap-3">
          {!selectedProduct ? (
            <label className="flex items-center gap-2 rounded-full border border-white/15 bg-black/30 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/70">
              Amount ({TOKEN_SYMBOL})
              <input
                value={customAmount}
                onChange={(event) => setCustomAmount(event.target.value)}
                placeholder="10.00"
                className="w-20 rounded-full border border-white/10 bg-black/60 px-2 py-1 text-xs font-mono text-white/80 outline-none focus:border-emerald-400/60 focus:ring-1 focus:ring-emerald-300/40"
              />
            </label>
          ) : null}
          <button
            onClick={handleCopyPayload}
            className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/80 transition hover:border-white/40 hover:text-white"
            type="button"
            disabled={!payload}
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
              alt="Coffee purchase QR"
              width={192}
              height={192}
              unoptimized
              className="rounded-2xl border border-white/10 bg-white/10 p-3 shadow-[0_35px_120px_-45px_rgba(59,130,246,0.8)]"
            />
          ) : (
            <div className="flex h-48 w-48 items-center justify-center rounded-2xl border border-dashed border-white/20 text-xs text-slate-400">
              {isGenerating ? 'Generating QR…' : 'Select a product to generate a QR code.'}
            </div>
          )}
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/50">
            Chain ID {expectedChainId}
          </p>
          {TOKEN_ADDRESS ? (
            <p className="text-[11px] uppercase tracking-[0.3em] text-white/50">
              Token {TOKEN_SYMBOL} ({TOKEN_ADDRESS.slice(0, 6)}…{TOKEN_ADDRESS.slice(-4)})
            </p>
          ) : (
            <p className="text-[11px] uppercase tracking-[0.3em] text-red-200">
              Token address not configured
            </p>
          )}
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/20 p-6 text-sm text-slate-200 shadow-inner shadow-indigo-900/20">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
            QR Payload Preview
          </p>
          <pre className="mt-3 max-h-48 overflow-auto rounded-2xl bg-black/40 p-4 text-xs text-emerald-200">
            {payload
              ? JSON.stringify(payload, null, 2)
              : '// Select a product to generate the QR payload.'}
          </pre>
          <p className="mt-3 text-xs text-slate-400">
            Customers scan this QR with a mobile wallet to pay; the loyalty contract automatically increments
            their stamp count once the transaction confirms.
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {COFFEE_MENU.map((product) => {
          const isActive = selectedProductId === product.id;
          return (
            <button
              key={product.id}
              type="button"
              onClick={() => {
                setSelectedProductId(product.id);
                setCustomAmount('');
              }}
              className={`flex h-full flex-col rounded-3xl border px-5 py-4 text-left transition shadow-lg shadow-slate-900/20 ${
                isActive
                  ? 'border-emerald-400/60 bg-emerald-400/10'
                  : 'border-white/10 bg-white/[0.03] hover:border-emerald-300/40 hover:bg-emerald-300/5'
              }`}
            >
              <span className="text-xs uppercase tracking-[0.4em] text-white/40">Coffee</span>
              <span className="mt-2 text-lg font-semibold text-white">{product.name}</span>
              <p className="mt-2 text-xs text-slate-300">{product.description}</p>
              <span className="mt-4 text-sm font-semibold text-emerald-200">
                {product.price} {TOKEN_SYMBOL}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => {
            setSelectedProductId(null);
            setCustomAmount('');
          }}
          className={`flex h-full flex-col rounded-3xl border px-5 py-4 text-left transition shadow-lg shadow-slate-900/20 ${
            selectedProductId === null
              ? 'border-emerald-400/60 bg-emerald-400/10'
              : 'border-white/10 bg-white/[0.03] hover:border-emerald-300/40 hover:bg-emerald-300/5'
          }`}
        >
          <span className="text-xs uppercase tracking-[0.4em] text-white/40">Custom</span>
          <span className="mt-2 text-lg font-semibold text-white">Custom Amount</span>
          <p className="mt-2 text-xs text-slate-300">
            Enter a custom BWT amount for specials or non-menu items.
          </p>
          <span className="mt-4 text-sm font-semibold text-emerald-200">Manual Entry</span>
        </button>
      </div>
    </div>
  );
}


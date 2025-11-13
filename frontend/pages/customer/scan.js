import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { toast } from 'react-toastify';
import { ethers } from 'ethers';
import { useWallet } from '../../context/WalletContext';
import { transferTokens } from '../../lib/web3';

const QrScanner = dynamic(
  () => import('@yudiel/react-qr-scanner').then((mod) => mod.Scanner),
  { ssr: false }
);

const decodePayload = (rawValue) => {
  if (!rawValue) return null;
  try {
    const parsed = JSON.parse(rawValue);
    if (parsed?.type === 'BWT_PURCHASE') {
      if (!parsed.to || !parsed.amount || !parsed.tokenAddress) return null;
      return {
        mode: 'purchase',
        to: parsed.to,
        amount: parsed.amount,
        tokenAddress: parsed.tokenAddress,
        tokenSymbol: parsed.tokenSymbol || 'BWT',
        chainId: parsed.chainId,
        decimals: parsed.decimals || 18,
        product: parsed.product || null,
      };
    }
    return null;
  } catch (error) {
    console.warn('Unable to decode QR payload:', error);
    return null;
  }
};

export default function CustomerScanPage() {
  const { customerAddress, customerSigner, isCorrectNetwork, ensureCorrectNetwork } = useWallet();
  const [scannerActive, setScannerActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [paymentRequest, setPaymentRequest] = useState(null);
  const [isPaying, setIsPaying] = useState(false);

  useEffect(() => {
    setCameraError('');
  }, [scannerActive]);

  const handleScan = useCallback(
    (detectedCodes) => {
      if (!detectedCodes?.length) return;
      const value = detectedCodes.find((code) => code?.rawValue)?.rawValue;
      if (!value) return;

      const decoded = decodePayload(value);
      if (!decoded) {
        setCameraError('Unrecognised BrewToken QR payload. Ask the barista for a fresh code.');
        return;
      }

      setPaymentRequest(decoded);
      setScannerActive(false);
      setCameraError('');
      toast.success(
        decoded.product?.name
          ? `Purchase detected: ${decoded.product.name}`
          : 'BrewToken payment detected.'
      );
    },
    []
  );

  const handleError = useCallback((error) => {
    console.error('Scanner error:', error);
    setCameraError('Unable to access the camera. Check permissions and try again.');
  }, []);

  const resetState = () => {
    setPaymentRequest(null);
    setIsPaying(false);
    setCameraError('');
    setScannerActive(false);
  };

  const executePayment = async () => {
    if (!customerAddress || !customerSigner) {
      toast.error('Connect your wallet before sending tokens.');
      return;
    }
    if (!paymentRequest) {
      toast.error('Scan a BrewToken QR code first.');
      return;
    }
    if (!isCorrectNetwork) {
      try {
        await ensureCorrectNetwork();
      } catch (error) {
        toast.error(error?.shortMessage || error?.message || 'Network switch rejected.');
        return;
      }
    }

    setIsPaying(true);
    try {
      const amount = ethers.parseUnits(paymentRequest.amount.toString(), paymentRequest.decimals);
      const { hash, receipt } = await transferTokens(paymentRequest.to, amount, customerSigner);
      toast.success(`Payment sent. Tx: ${hash.slice(0, 10)}…`);

      const payload = {
        address: customerAddress,
        productId: paymentRequest.product?.id,
        productName: paymentRequest.product?.name,
        priceBWT: paymentRequest.amount,
        txHash: hash,
        blockNumber: receipt?.blockNumber || null,
        metadata: paymentRequest.product || null,
      };

      await fetch('/api/stamps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch((error) => console.error('Failed to sync purchase', error));

      setPaymentRequest(null);
    } catch (error) {
      console.error('Token payment failed:', error);
      toast.error(error?.shortMessage || error?.message || 'Payment failed');
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <>
      <Head>
        <title>Scan &amp; Pay · BrewToken Coffee Loyalty</title>
      </Head>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3">
          <p className="text-xs uppercase tracking-[0.4em] text-blue-200">Customer Flow</p>
          <h1 className="text-3xl font-semibold text-white sm:text-4xl">Scan Merchant QR</h1>
          <p className="text-sm text-slate-300">
            Align the QR code with your camera. We detect BrewToken purchases and auto-sync your stamp progress
            once the payment confirms on-chain.
          </p>
        </div>

        {!customerAddress ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-center text-slate-300">
            Connect your wallet to start scanning.
          </div>
        ) : (
          <>
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-xl shadow-indigo-900/40 backdrop-blur-2xl sm:p-8">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-white">QR Scanner</h2>
                  <p className="mt-2 text-sm text-slate-300">
                    Use your phone&apos;s camera to scan BrewToken payment codes at the counter. We take care of the
                    token transfer and stamp update automatically.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => setScannerActive((prev) => !prev)}
                    className="rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 px-5 py-2 text-xs font-semibold uppercase tracking-widest text-white shadow-lg shadow-indigo-600/40 transition hover:scale-[1.02]"
                  >
                    {scannerActive ? 'Close Scanner' : 'Start Scanner'}
                  </button>
                  <button
                    onClick={resetState}
                    className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white/70 transition hover:border-white/40 hover:text-white"
                  >
                    Reset
                  </button>
                </div>
              </div>

              {cameraError ? (
                <p className="mt-4 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {cameraError}
                </p>
              ) : null}

              {scannerActive && QrScanner ? (
                <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-blue-900/40">
                  <div className="relative mx-auto aspect-[4/3] w-full max-w-[420px] overflow-hidden rounded-2xl border border-white/10 shadow-[0_35px_120px_-40px_rgba(79,70,229,0.9)]">
                    <QrScanner
                      onScan={handleScan}
                      onError={handleError}
                      constraints={{ facingMode: 'environment' }}
                      styles={{
                        container: { width: '100%', height: '100%' },
                        video: { width: '100%', height: '100%', objectFit: 'cover' },
                      }}
                    />
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="h-40 w-40 rounded-2xl border-4 border-white/80 shadow-[0_0_40px_rgba(255,255,255,0.25)]" />
                    </div>
                    <div className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-xs font-semibold uppercase tracking-widest text-white drop-shadow">
                      Align QR within the frame
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-slate-400">
                    If scanning fails, ensure the QR belongs to the BrewToken loyalty network or request a new code
                    from the barista.
                  </p>
                </div>
              ) : null}
            </div>

            {paymentRequest ? (
              <div className="rounded-3xl border border-purple-400/40 bg-purple-500/10 p-6 shadow-xl shadow-purple-900/40 backdrop-blur-xl">
                <h3 className="text-lg font-semibold text-white">
                  {paymentRequest.product?.name ? `Purchase · ${paymentRequest.product.name}` : 'BWT Payment Request'}
                </h3>
                <dl className="mt-4 grid gap-3 text-sm text-purple-100/90">
                  <div>
                    <dt className="text-xs uppercase tracking-[0.3em] text-white/60">Recipient</dt>
                    <dd className="font-mono text-xs text-white/80">{paymentRequest.to}</dd>
                  </div>
                  {paymentRequest.product?.description ? (
                    <div>
                      <dt className="text-xs uppercase tracking-[0.3em] text-white/60">Drink</dt>
                      <dd>{paymentRequest.product.description}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="text-xs uppercase tracking-[0.3em] text-white/60">Amount</dt>
                    <dd>
                      {paymentRequest.amount} {paymentRequest.tokenSymbol}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.3em] text-white/60">Token</dt>
                    <dd className="font-mono text-xs text-white/80">{paymentRequest.tokenAddress}</dd>
                  </div>
                </dl>
                <button
                  onClick={executePayment}
                  disabled={isPaying}
                  className="mt-6 w-full rounded-full bg-gradient-to-r from-purple-400 via-pink-300 to-rose-300 px-6 py-3 text-xs font-semibold uppercase tracking-widest text-slate-900 shadow-lg shadow-purple-500/40 transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isPaying ? 'Sending…' : 'Pay with MetaMask'}
                </button>
                <p className="mt-3 text-xs text-purple-100/80">
                  Confirm the BrewToken transfer in MetaMask. Once the transaction is complete, your stamp balance will
                  update automatically.
                </p>
              </div>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}


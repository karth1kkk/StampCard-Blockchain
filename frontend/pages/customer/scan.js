import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { toast } from 'react-toastify';
import { useWallet } from '../../context/WalletContext';
import { issueStamp } from '../../lib/web3';

const QrScanner = dynamic(
  () => import('@yudiel/react-qr-scanner').then((mod) => mod.Scanner),
  { ssr: false }
);

const decodePayload = (rawValue) => {
  if (!rawValue) return null;
  try {
    const parsed = JSON.parse(rawValue);
    if (parsed?.type !== 'STAMP_CHALLENGE') return null;
    if (!parsed.outletId || !parsed.challengeUrl || !parsed.merchantAddress) return null;
    return {
      outletId: Number(parsed.outletId),
      challengeUrl: parsed.challengeUrl,
      merchantAddress: parsed.merchantAddress,
      businessName: parsed.businessName || 'Merchant',
      location: parsed.location || 'Unknown location',
      website: parsed.website || null,
    };
  } catch (error) {
    console.warn('Unable to decode QR payload:', error);
    return null;
  }
};

const BusinessInfo = ({ businessName, location, website }) => (
  <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-xl shadow-slate-900/40 backdrop-blur-xl">
    <h3 className="text-lg font-semibold text-white">Business Info</h3>
    <dl className="mt-4 space-y-3 text-sm text-slate-200">
      <div className="grid gap-1">
        <dt className="text-xs uppercase tracking-[0.3em] text-white/60">Name</dt>
        <dd>{businessName}</dd>
      </div>
      <div className="grid gap-1">
        <dt className="text-xs uppercase tracking-[0.3em] text-white/60">Location (Address)</dt>
        <dd>{location}</dd>
      </div>
      <div className="grid gap-1">
        <dt className="text-xs uppercase tracking-[0.3em] text-white/60">Website</dt>
        <dd>
          {website ? (
            <a
              href={website}
              target="_blank"
              rel="noreferrer"
              className="text-blue-300 underline decoration-dotted underline-offset-4 hover:text-blue-100"
            >
              {website}
            </a>
          ) : (
            'Not provided'
          )}
        </dd>
      </div>
    </dl>
  </div>
);

export default function CustomerScanPage() {
  const { account, signer, isCorrectNetwork, switchToExpectedNetwork } = useWallet();
  const [scannerActive, setScannerActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [challenge, setChallenge] = useState(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        setCameraError('Unrecognised StampCard QR payload. Ask the merchant for a valid code.');
        return;
      }

      setChallenge(decoded);
      setScannerActive(false);
      setCameraError('');
      toast.success(`Merchant ${decoded.businessName} detected.`);
    },
    [setChallenge]
  );

  const handleError = useCallback((error) => {
    console.error('Scanner error:', error);
    setCameraError('Unable to access the camera. Check permissions and try again.');
  }, []);

  const resetState = () => {
    setChallenge(null);
    setIsRequesting(false);
    setIsSubmitting(false);
    setCameraError('');
    setScannerActive(false);
  };

  const requestStamp = async () => {
    if (!account || !signer) {
      toast.error('Connect your wallet before requesting a stamp.');
      return;
    }
    if (!isCorrectNetwork) {
      try {
        await switchToExpectedNetwork();
      } catch (error) {
        toast.error(error?.shortMessage || error?.message || 'Network switch rejected.');
        return;
      }
    }
    if (!challenge) {
      toast.error('Scan a merchant QR code first.');
      return;
    }

    setIsRequesting(true);
    try {
      const url = new URL(challenge.challengeUrl, window.location.origin);
      url.searchParams.set('customer', account);
      url.searchParams.set('outletId', challenge.outletId.toString());
      url.searchParams.set('merchant', challenge.merchantAddress);

      const response = await fetch(url.toString(), { method: 'GET' });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody?.error || 'Merchant challenge request failed.');
      }

      const { signature, nonce } = await response.json();
      if (!signature) {
        throw new Error('Challenge payload missing signature.');
      }

      setIsRequesting(false);
      setIsSubmitting(true);

      const { hash } = await issueStamp(
        {
          customerAddress: account,
          outletId: challenge.outletId,
          signaturePayload: signature,
        },
        signer
      );

      toast.success(`Stamp requested. Tx: ${hash.slice(0, 10)}…`);
    } catch (error) {
      console.error('Stamp request failed:', error);
      toast.error(error?.shortMessage || error?.message || 'Request failed');
    } finally {
      setIsRequesting(false);
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Head>
        <title>StampCard - Customer Scan</title>
      </Head>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3">
          <p className="text-xs uppercase tracking-[0.4em] text-blue-200">Customer Flow</p>
          <h1 className="text-3xl font-semibold text-white sm:text-4xl">Scan Merchant QR</h1>
          <p className="text-sm text-slate-300">
            Scan the QR displayed at the merchant&apos;s outlet. This generates a merchant-signed
            challenge and prompts your wallet to mint a stamp on-chain.
          </p>
        </div>

        {!account ? (
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
                    Align the merchant&apos;s StampCard QR within the frame. We automatically fetch
                    the signed challenge tied to your wallet.
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
                    If the merchant QR fails to scan, ensure it belongs to the StampCard network or
                    request a fresh code from the staff.
                  </p>
                </div>
              ) : null}
            </div>

            {challenge ? (
              <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                <BusinessInfo
                  businessName={challenge.businessName}
                  location={challenge.location}
                  website={challenge.website}
                />
                <div className="rounded-3xl border border-emerald-400/30 bg-emerald-400/10 p-6 shadow-xl shadow-emerald-900/40 backdrop-blur-xl">
                  <h3 className="text-lg font-semibold text-white">Ready to request a stamp</h3>
                  <p className="mt-2 text-sm text-emerald-100/80">
                    We&apos;ll fetch a merchant signature for outlet{' '}
                    <span className="font-semibold">#{challenge.outletId}</span>. After approval, your
                    wallet will submit the on-chain transaction.
                  </p>
                  <button
                    onClick={requestStamp}
                    disabled={isRequesting || isSubmitting}
                    className="mt-6 w-full rounded-full bg-gradient-to-r from-emerald-300 via-lime-300 to-sky-300 px-6 py-3 text-xs font-semibold uppercase tracking-widest text-slate-900 shadow-lg shadow-emerald-400/40 transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSubmitting
                      ? 'Submitting transaction…'
                      : isRequesting
                      ? 'Fetching signature…'
                      : 'Sign & Mint Stamp'}
                  </button>
                  <p className="mt-3 text-xs text-emerald-100/80">
                    Your wallet must sign the transfer. Ensure you have network funds to cover gas
                    fees.
                  </p>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}


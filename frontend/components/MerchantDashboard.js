import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useWallet } from '../context/WalletContext';
import { issueStamp, getContractReadOnly } from '../lib/web3';
import { toast } from 'react-toastify';
import { STAMPS_PER_REWARD, QR_PREFIX } from '../lib/constants';

const CustomerScanner = dynamic(
  () => import('@yudiel/react-qr-scanner').then((mod) => mod.Scanner),
  {
    ssr: false,
  }
);

export default function MerchantDashboard() {
  const { account, provider, signer, isOwner } = useWallet();
  const [customerAddress, setCustomerAddress] = useState('');
  const [isIssuing, setIsIssuing] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scanError, setScanError] = useState('');
  const [analytics, setAnalytics] = useState({
    totalStampsIssued: 0,
    totalRewardsGranted: 0,
    totalCustomers: 0,
  });

  useEffect(() => {
    if (account && provider && isOwner) {
      loadAnalytics();
    }
  }, [account, provider, isOwner]);

  const loadAnalytics = async () => {
    if (!provider) return;
    
    try {
      const contract = getContractReadOnly(provider);
      
      // Get recent events to calculate analytics
      const stampEvents = await contract.queryFilter(contract.filters.StampIssued(), -1000);
      const rewardEvents = await contract.queryFilter(contract.filters.RewardGranted(), -1000);
      
      const uniqueCustomers = new Set();
      stampEvents.forEach(event => {
        uniqueCustomers.add(event.args.customer.toLowerCase());
      });

      setAnalytics({
        totalStampsIssued: stampEvents.length,
        totalRewardsGranted: rewardEvents.length,
        totalCustomers: uniqueCustomers.size,
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
    }
  };

  const extractAddressFromScan = useCallback((value) => {
    if (!value) {
      return null;
    }

    const raw = value.trim();
    if (raw.startsWith(QR_PREFIX)) {
      return raw.slice(QR_PREFIX.length);
    }

    if (/^0x[a-fA-F0-9]{40}$/.test(raw)) {
      return raw;
    }

    return null;
  }, []);

  const handleScan = useCallback(
    (detectedCodes) => {
      if (!detectedCodes?.length) return;
      const raw = detectedCodes.find((code) => code?.rawValue)?.rawValue;
      if (!raw) return;

      const extractedAddress = extractAddressFromScan(raw);
      if (extractedAddress) {
        if (hasScanned && extractedAddress === customerAddress) {
          return;
        }
        setCustomerAddress(extractedAddress);
        setHasScanned(true);
        setShowScanner(false);
        setScanError('');
        toast.success('Customer QR scanned successfully');
      } else {
        setScanError('QR code is not a valid StampCard wallet QR');
      }
    },
    [extractAddressFromScan, hasScanned, customerAddress]
  );

  const handleScanError = useCallback((error) => {
    if (error) {
      setScanError('Unable to read QR code. Please try again.');
    }
  }, []);

  const handleIssueStamp = async () => {
    if (!hasScanned) {
      toast.error('Please scan the customer QR code before issuing a stamp');
      return;
    }

    if (!account || !signer) {
      toast.error('Please connect your wallet');
      return;
    }

    if (!isOwner) {
      toast.error('Only the contract owner can issue stamps');
      return;
    }

    // Validate address
    if (!/^0x[a-fA-F0-9]{40}$/.test(customerAddress)) {
      toast.error('Invalid Ethereum address');
      return;
    }

    setIsIssuing(true);
    try {
      const txHash = await issueStamp(customerAddress, signer);
      toast.success(`Stamp issued! Transaction: ${txHash.slice(0, 10)}...`);
      
      // Save transaction to database
      await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerAddress,
          transactionHash: txHash,
          transactionType: 'stamp_issued',
          blockNumber: 0,
        }),
      });

      setCustomerAddress('');
      setHasScanned(false);
      await loadAnalytics();
    } catch (error) {
      toast.error(error.message || 'Failed to issue stamp');
      console.error(error);
    } finally {
      setIsIssuing(false);
    }
  };

  if (!isOwner) {
    return (
      <div className="py-12 text-center text-slate-300">
        <p>You are not authorized to access the merchant dashboard.</p>
        <p className="mt-2 text-sm text-slate-400">Only the contract owner can issue stamps.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-purple-200">Owner Controls</p>
          <h2 className="text-3xl font-semibold text-white sm:text-4xl">Merchant Dashboard</h2>
        </div>
        <button
          onClick={loadAnalytics}
          className="inline-flex items-center justify-center rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white/80 transition hover:border-white/40 hover:text-white"
        >
          Refresh Analytics
        </button>
      </div>

      {/* Info Card */}
      <div className="relative overflow-hidden rounded-3xl border border-emerald-400/30 bg-emerald-400/10 p-6 shadow-[0_40px_120px_-60px_rgba(16,185,129,0.75)] backdrop-blur-xl">
        <div className="absolute -right-24 bottom-0 h-44 w-44 rounded-full bg-emerald-400/20 blur-[130px]" />
        <h3 className="relative mb-3 text-lg font-semibold text-emerald-100">How to issue stamps</h3>
        <ol className="relative space-y-2 text-sm text-emerald-100/90 list-decimal list-inside">
          <li>Customer makes a purchase</li>
          <li>Ask the customer to show their StampCard QR code</li>
          <li>Tap "Scan Customer QR" and scan the code to capture their wallet</li>
          <li>Click "Issue Stamp" to record the transaction</li>
          <li>Confirm the transaction in MetaMask</li>
          <li>The customer automatically receives 1 stamp!</li>
        </ol>
        <p className="relative mt-3 text-xs text-emerald-100/80">
          <strong>Note:</strong> When a customer collects {STAMPS_PER_REWARD} stamps, they automatically receive 1 reward - no action needed!
        </p>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-blue-500/20 bg-blue-500/10 p-6 shadow-xl shadow-blue-900/40 backdrop-blur-2xl">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-blue-100/70">Total Stamps Issued</h3>
          <div className="mt-3 text-4xl font-bold text-blue-100">{analytics.totalStampsIssued}</div>
        </div>
        <div className="rounded-3xl border border-purple-500/30 bg-purple-500/10 p-6 shadow-xl shadow-purple-900/40 backdrop-blur-2xl">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-purple-100/70">Total Rewards Granted</h3>
          <div className="mt-3 text-4xl font-bold text-purple-100">{analytics.totalRewardsGranted}</div>
        </div>
        <div className="rounded-3xl border border-cyan-400/30 bg-cyan-400/10 p-6 shadow-xl shadow-cyan-900/40 backdrop-blur-2xl">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-cyan-100/70">Total Customers</h3>
          <div className="mt-3 text-4xl font-bold text-cyan-100">{analytics.totalCustomers}</div>
        </div>
      </div>

      {/* Issue Stamp Card */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-indigo-900/40 backdrop-blur-2xl sm:p-8">
        <h3 className="text-2xl font-semibold text-white">Issue Stamp After Purchase</h3>
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
              Customer QR Scan
            </label>
            <div className="flex flex-col gap-3 md:flex-row">
              <button
                onClick={() => {
                  setShowScanner((prev) => !prev);
                  setScanError('');
                }}
                className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white shadow-lg shadow-blue-600/40 transition hover:scale-[1.02]"
              >
                {showScanner ? 'Close Scanner' : 'Scan Customer QR'}
              </button>
              <div className="flex-1">
                <input
                  type="text"
                  value={customerAddress}
                  readOnly
                  placeholder="Scan customer QR to capture wallet address"
                  className="w-full rounded-2xl border border-white/20 bg-black/40 px-4 py-2 font-mono text-sm text-white/80 outline-none transition focus:border-blue-400/60 focus:ring-2 focus:ring-blue-400/40"
                />
                <p className="mt-2 text-xs text-slate-400">
                  The address is filled automatically when you scan a valid StampCard QR code.
                </p>
              </div>
            </div>
            {scanError && <p className="mt-2 text-xs text-red-300">{scanError}</p>}
          </div>
          {showScanner && CustomerScanner ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-blue-900/40">
              <CustomerScanner
                onScan={handleScan}
                onError={handleScanError}
                constraints={{ facingMode: 'environment' }}
                styles={{
                  container: { width: '100%' },
                  video: { width: '100%', borderRadius: '0.75rem' },
                }}
              />
              <p className="mt-2 text-xs text-slate-400">
                Align the customer&apos;s QR code within the frame. The scan must succeed before issuing a stamp.
              </p>
            </div>
          ) : null}
          <button
            onClick={handleIssueStamp}
            disabled={isIssuing || !customerAddress || !hasScanned}
            className="w-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-400 to-blue-500 px-6 py-3 text-xs font-semibold uppercase tracking-widest text-slate-900 shadow-lg shadow-emerald-400/30 transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isIssuing ? 'Issuing Stamp...' : 'Issue Stamp (After Purchase)'}
          </button>
        </div>
      </div>
    </div>
  );
}


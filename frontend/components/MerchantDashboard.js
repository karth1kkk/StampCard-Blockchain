import { useState, useEffect, useMemo, useCallback } from 'react';
import QRCode from 'react-qr-code';
import { ethers } from 'ethers';
import { toast } from 'react-toastify';
import { useWallet } from '../context/WalletContext';
import {
  authorizeMerchant,
  revokeMerchant,
  isMerchantAuthorizedOnChain,
  getContractReadOnly,
} from '../lib/web3';
import { STAMPS_PER_REWARD } from '../lib/constants';
import ConnectViaQR from './ConnectViaQR';

const DEFAULT_CHALLENGE_URL =
  process.env.NEXT_PUBLIC_MERCHANT_CHALLENGE_URL || '/api/merchant/challenge';

const isValidAddress = (value) => !!value && ethers.isAddress(value);

export default function MerchantDashboard() {
  const {
    merchantAddress,
    provider,
    merchantSigner,
    isOwner,
    isMerchant,
    isCorrectNetwork,
    ensureCorrectNetwork,
  } = useWallet();

  const [analytics, setAnalytics] = useState({
    totalStampsIssued: 0,
    totalRewardsGranted: 0,
    totalCustomers: 0,
  });
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const [outlets, setOutlets] = useState([]);
  const [selectedOutletId, setSelectedOutletId] = useState(null);
  const [outletsLoading, setOutletsLoading] = useState(false);

  const [newOutlet, setNewOutlet] = useState({
    name: '',
    location: '',
    website: '',
    challengeUrl: DEFAULT_CHALLENGE_URL,
    merchantAddress: '',
  });
  const [isRegisteringOutlet, setIsRegisteringOutlet] = useState(false);

  const [authAddress, setAuthAddress] = useState('');
  const [authStatus, setAuthStatus] = useState(null);
  const [isAuthorising, setIsAuthorising] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);

  const loadAnalytics = useCallback(async () => {
    if (!provider) return;

    setAnalyticsLoading(true);
    try {
      const contract = getContractReadOnly(provider);
      const stampEvents = await contract.queryFilter(contract.filters.StampIssued(), -1000);
      const rewardEvents = await contract.queryFilter(contract.filters.RewardGranted(), -1000);

      const uniqueCustomers = new Set();
      stampEvents.forEach((event) => {
        uniqueCustomers.add(event.args.customer.toLowerCase());
      });

      setAnalytics({
        totalStampsIssued: stampEvents.length,
        totalRewardsGranted: rewardEvents.length,
        totalCustomers: uniqueCustomers.size,
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
      toast.error('Unable to load contract analytics.');
    } finally {
      setAnalyticsLoading(false);
    }
  }, [provider]);

  const loadOutlets = useCallback(async () => {
    if (!merchantAddress) return;

    setOutletsLoading(true);
    try {
      const response = await fetch('/api/outlets');
      if (!response.ok) {
        throw new Error('Failed to fetch outlets');
      }
      const data = await response.json();
      const list = Array.isArray(data) ? data : [];
      if (isOwner) {
        setOutlets(list);
      } else {
        const lowerAccount = merchantAddress.toLowerCase();
        const filtered = list.filter((outlet) => {
          const merchantAddress =
            (outlet.merchant_address || outlet.merchantAddress || '').toLowerCase();
          return merchantAddress && merchantAddress === lowerAccount;
        });
        setOutlets(filtered);
      }
    } catch (error) {
      console.error('Outlet fetch failed:', error);
      toast.error(error?.message || 'Unable to load merchant outlets.');
      setOutlets([]);
    } finally {
      setOutletsLoading(false);
    }
  }, [merchantAddress, isOwner]);

  useEffect(() => {
    if (merchantAddress && provider && (isOwner || isMerchant)) {
      loadAnalytics();
      loadOutlets();
    }
  }, [merchantAddress, provider, isOwner, isMerchant, loadAnalytics, loadOutlets]);

  useEffect(() => {
    if (!ethers.isAddress(authAddress) || !provider) {
      setAuthStatus(null);
      return;
    }

    let ignore = false;
    const run = async () => {
      const status = await isMerchantAuthorizedOnChain(authAddress, provider);
      if (!ignore) {
        setAuthStatus(status);
      }
    };
    run().catch((error) => console.error('Authorization status check failed:', error));
    return () => {
      ignore = true;
    };
  }, [authAddress, provider]);

  useEffect(() => {
    if (!outlets.length) {
      setSelectedOutletId(null);
      return;
    }
    if (!selectedOutletId || !outlets.some((outlet) => outlet.id === selectedOutletId)) {
      setSelectedOutletId(outlets[0].id);
    }
  }, [outlets, selectedOutletId]);

  const selectedOutlet = useMemo(
    () => outlets.find((outlet) => outlet.id === selectedOutletId) || null,
    [outlets, selectedOutletId]
  );

  const selectedMerchantAddress = selectedOutlet?.merchant_address || '';
  const selectedChallengeUrl =
    selectedOutlet?.challenge_url || selectedOutlet?.challengeUrl || DEFAULT_CHALLENGE_URL;

  const qrPayload = useMemo(() => {
    if (!selectedOutlet || !selectedMerchantAddress || !selectedChallengeUrl) {
      return null;
    }
    const payload = {
      type: 'STAMP_CHALLENGE',
      outletId: selectedOutlet.id,
      merchantAddress: selectedMerchantAddress,
      challengeUrl: selectedChallengeUrl,
      businessName: selectedOutlet.name || 'Merchant',
      location: selectedOutlet.location || 'Unknown location',
      website: selectedOutlet.website || '',
    };
    return JSON.stringify(payload);
  }, [selectedOutlet, selectedMerchantAddress, selectedChallengeUrl]);

  const noOutletMessage = isOwner
    ? 'No outlets registered yet. Use the form above to add your first location.'
    : 'No outlets are linked to this merchant wallet yet. Ask the contract owner to register an outlet with your signer address.';

  const ensureNetwork = useCallback(async () => {
    if (!isCorrectNetwork) {
      await ensureCorrectNetwork();
    }
  }, [isCorrectNetwork, ensureCorrectNetwork]);

  const handleAuthorize = async () => {
    if (!merchantSigner) {
      toast.error('Connect your wallet before authorising a merchant.');
      return;
    }
    if (!isOwner) {
      toast.error('Only the contract owner can manage merchant authorisations.');
      return;
    }
    if (!isValidAddress(authAddress)) {
      toast.error('Enter a valid merchant address.');
      return;
    }

    setIsAuthorising(true);
    try {
      await ensureNetwork();
      const { hash } = await authorizeMerchant(authAddress, merchantSigner);
      toast.success(`Merchant authorised. Tx: ${hash.slice(0, 10)}…`);
      if (provider) {
        const status = await isMerchantAuthorizedOnChain(authAddress, provider);
        setAuthStatus(status);
      }
    } catch (error) {
      console.error('Authorise merchant failed:', error);
      toast.error(error?.shortMessage || error?.message || 'Authorisation failed.');
    } finally {
      setIsAuthorising(false);
    }
  };

  const handleRevoke = async () => {
    if (!merchantSigner) {
      toast.error('Connect your wallet before revoking a merchant.');
      return;
    }
    if (!isOwner) {
      toast.error('Only the contract owner can manage merchant authorisations.');
      return;
    }
    if (!isValidAddress(authAddress)) {
      toast.error('Enter a valid merchant address.');
      return;
    }

    setIsRevoking(true);
    try {
      await ensureNetwork();
      const { hash } = await revokeMerchant(authAddress, merchantSigner);
      toast.success(`Merchant revoked. Tx: ${hash.slice(0, 10)}…`);
      if (provider) {
        const status = await isMerchantAuthorizedOnChain(authAddress, provider);
        setAuthStatus(status);
      }
    } catch (error) {
      console.error('Revoke merchant failed:', error);
      toast.error(error?.shortMessage || error?.message || 'Revoke failed.');
    } finally {
      setIsRevoking(false);
    }
  };

  const handleRegisterOutlet = async (event) => {
    event.preventDefault();
    if (!isOwner) {
      toast.error('Only the contract owner can register new outlets.');
      return;
    }
    if (!newOutlet.name || !newOutlet.challengeUrl) {
      toast.error('Outlet name and challenge URL are required.');
      return;
    }
    if (newOutlet.merchantAddress && !isValidAddress(newOutlet.merchantAddress)) {
      toast.error('Merchant signer address must be a valid Ethereum address.');
      return;
    }

    setIsRegisteringOutlet(true);
    try {
      const response = await fetch('/api/outlets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newOutlet.name,
          ownerAddress: merchantAddress,
          merchantAddress: newOutlet.merchantAddress,
          location: newOutlet.location,
          website: newOutlet.website,
          challengeUrl: newOutlet.challengeUrl,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || 'Failed to register outlet.');
      }

      toast.success('Outlet registered. QR ready for printing.');
      setNewOutlet({
        name: '',
        location: '',
        website: '',
        challengeUrl: DEFAULT_CHALLENGE_URL,
        merchantAddress: '',
      });
      await loadOutlets();
    } catch (error) {
      console.error('Register outlet failed:', error);
      toast.error(error?.message || 'Unable to register outlet.');
    } finally {
      setIsRegisteringOutlet(false);
    }
  };

  const copyQrPayload = async () => {
    if (!qrPayload) return;
    try {
      await navigator.clipboard.writeText(qrPayload);
      toast.success('QR payload copied to clipboard.');
    } catch (error) {
      console.error('Copy QR payload failed:', error);
      toast.error('Unable to copy QR payload.');
    }
  };

  if (!isOwner && !isMerchant) {
    return (
      <div className="py-12 text-center text-slate-300">
        <p>You are not authorised to access the merchant dashboard.</p>
        <p className="mt-2 text-sm text-slate-400">
          Only the contract owner or an authorised merchant signer can manage these tools.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-purple-200">
            {isOwner ? 'Owner Controls' : 'Merchant Access'}
          </p>
          <h2 className="text-3xl font-semibold text-white sm:text-4xl">
            Merchant Operations Console
          </h2>
          <p className="mt-2 max-w-xl text-sm text-slate-300">
            {isOwner
              ? 'Register new outlets, authorise signer keys, and generate QR payloads. Customers scan these codes to request stamps from their own wallets.'
              : 'Preview outlet QR codes and monitor programme activity. Contact the contract owner if you need new outlets or signer permissions.'}
          </p>
        </div>
        <button
          onClick={loadAnalytics}
          className="inline-flex items-center justify-center rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white/80 transition hover:border-white/40 hover:text-white"
        >
          {analyticsLoading ? 'Refreshing…' : 'Refresh Analytics'}
        </button>
      </div>
      {isOwner ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <form
            onSubmit={handleRegisterOutlet}
            className="relative overflow-hidden rounded-3xl border border-emerald-400/30 bg-emerald-400/10 p-6 shadow-[0_40px_120px_-60px_rgba(16,185,129,0.75)] backdrop-blur-xl"
          >
            <div className="pointer-events-none absolute -right-24 bottom-0 h-44 w-44 rounded-full bg-emerald-400/20 blur-[130px]" />
            <div className="relative space-y-4">
              <h3 className="text-lg font-semibold text-emerald-100">Register Outlet Metadata</h3>
              <p className="text-sm text-emerald-100/80">
                Stored off-chain in Supabase to power analytics and QR generation. Challenge URL
                should point to your merchant signer endpoint.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
                  Outlet Name
                  <input
                    value={newOutlet.name}
                    onChange={(event) =>
                      setNewOutlet((prev) => ({ ...prev, name: event.target.value }))
                    }
                    required
                    className="rounded-2xl border border-white/20 bg-black/40 px-3 py-2 text-sm text-white/80 outline-none transition focus:border-emerald-300/60 focus:ring-2 focus:ring-emerald-300/40"
                    placeholder="Stamp & Sip Café"
                  />
                </label>
                <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
                  Merchant Signer Address
                  <input
                    value={newOutlet.merchantAddress}
                    onChange={(event) =>
                      setNewOutlet((prev) => ({ ...prev, merchantAddress: event.target.value }))
                    }
                    className="rounded-2xl border border-white/20 bg-black/40 px-3 py-2 font-mono text-xs text-white/80 outline-none transition focus:border-emerald-300/60 focus:ring-2 focus:ring-emerald-300/40"
                    placeholder="0xSigner..."
                  />
                  <span className="text-[10px] uppercase tracking-widest text-white/40">
                    Must match MERCHANT_SIGNER_PRIVATE_KEY (dev only).
                  </span>
                </label>
                <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
                  Location (Address)
                  <input
                    value={newOutlet.location}
                    onChange={(event) =>
                      setNewOutlet((prev) => ({ ...prev, location: event.target.value }))
                    }
                    className="rounded-2xl border border-white/20 bg-black/40 px-3 py-2 text-sm text-white/80 outline-none transition focus:border-emerald-300/60 focus:ring-2 focus:ring-emerald-300/40"
                    placeholder="123 Bean Street, Singapore"
                  />
                </label>
                <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
                  Website
                  <input
                    value={newOutlet.website}
                    onChange={(event) =>
                      setNewOutlet((prev) => ({ ...prev, website: event.target.value }))
                    }
                    className="rounded-2xl border border-white/20 bg-black/40 px-3 py-2 text-sm text-white/80 outline-none transition focus:border-emerald-300/60 focus:ring-2 focus:ring-emerald-300/40"
                    placeholder="https://stampandsip.com"
                  />
                </label>
              </div>
              <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
                Challenge URL
                <input
                  value={newOutlet.challengeUrl}
                  onChange={(event) =>
                    setNewOutlet((prev) => ({ ...prev, challengeUrl: event.target.value }))
                  }
                  required
                  className="rounded-2xl border border-white/20 bg-black/40 px-3 py-2 text-sm text-white/80 outline-none transition focus:border-emerald-300/60 focus:ring-2 focus:ring-emerald-300/40"
                  placeholder={DEFAULT_CHALLENGE_URL}
                />
                <span className="text-[10px] uppercase tracking-widest text-white/40">
                  Customers call this endpoint to fetch the merchant-signed challenge.
                </span>
              </label>
              <button
                type="submit"
                disabled={isRegisteringOutlet}
                className="w-full rounded-full bg-gradient-to-r from-emerald-300 via-lime-300 to-sky-300 px-6 py-3 text-xs font-semibold uppercase tracking-widest text-slate-900 shadow-lg shadow-emerald-400/40 transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRegisteringOutlet ? 'Saving outlet…' : 'Save Outlet'}
              </button>
            </div>
          </form>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-indigo-900/40 backdrop-blur-2xl">
            <h3 className="text-lg font-semibold text-white">Authorise Merchant Signers</h3>
            <p className="mt-2 text-sm text-slate-300">
              Stamps can only be minted when a customer presents a signature from an authorised
              merchant. Use this form to manage the allowlist.
            </p>
            <div className="mt-5 space-y-4">
              <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
                Merchant Address
                <input
                  value={authAddress}
                  onChange={(event) => setAuthAddress(event.target.value)}
                  placeholder="0xMerchant..."
                  className="rounded-2xl border border-white/20 bg-black/40 px-3 py-2 font-mono text-xs text-white/80 outline-none transition focus:border-blue-400/60 focus:ring-2 focus:ring-blue-400/40"
                />
              </label>
              {authStatus !== null && (
                <p
                  className={`text-xs font-semibold uppercase tracking-widest ${
                    authStatus ? 'text-emerald-300' : 'text-red-300'
                  }`}
                >
                  Status: {authStatus ? 'Authorised' : 'Not authorised'}
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={handleAuthorize}
                  disabled={isAuthorising}
                  className="rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white shadow-lg shadow-blue-600/40 transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isAuthorising ? 'Authorising…' : 'Authorise'}
                </button>
                <button
                  type="button"
                  onClick={handleRevoke}
                  disabled={isRevoking}
                  className="rounded-full border border-red-400/40 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-red-200 transition hover:border-red-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isRevoking ? 'Revoking…' : 'Revoke'}
                </button>
              </div>
              <p className="text-[11px] uppercase tracking-widest text-white/40">
                Ensure you run `set MERCHANT_SIGNER_PRIVATE_KEY` on the server with the authorised
                signer&apos;s private key (dev only).
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-indigo-900/40 backdrop-blur-2xl">
          <h3 className="text-lg font-semibold text-white">Authorised Merchant Session</h3>
          <p className="mt-2 text-sm text-slate-300">
            Connected wallet{' '}
            <span className="font-mono text-xs text-slate-100">{merchantAddress}</span> is
            authorised to issue QR codes and view analytics. Ask the contract owner if you need new
            outlets or signer changes.
          </p>
          <p className="mt-4 text-xs text-slate-400">
            Use the QR generator below to print codes for your assigned outlets. Each QR encodes the
            location, website, and challenge endpoint required by customers.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-blue-500/20 bg-blue-500/10 p-6 shadow-xl shadow-blue-900/40 backdrop-blur-2xl">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-blue-100/70">
            Total Stamps Issued
          </h3>
          <div className="mt-3 text-4xl font-bold text-blue-100">{analytics.totalStampsIssued}</div>
        </div>
        <div className="rounded-3xl border border-purple-500/30 bg-purple-500/10 p-6 shadow-xl shadow-purple-900/40 backdrop-blur-2xl">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-purple-100/70">
            Total Rewards Granted
          </h3>
          <div className="mt-3 text-4xl font-bold text-purple-100">
            {analytics.totalRewardsGranted}
          </div>
        </div>
        <div className="rounded-3xl border border-cyan-400/30 bg-cyan-400/10 p-6 shadow-xl shadow-cyan-900/40 backdrop-blur-2xl">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-cyan-100/70">
            Active Customers
          </h3>
          <div className="mt-3 text-4xl font-bold text-cyan-100">{analytics.totalCustomers}</div>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-indigo-900/40 backdrop-blur-2xl sm:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-2xl font-semibold text-white">Outlet QR Generator</h3>
            <p className="mt-2 text-sm text-slate-300">
              Select an outlet to preview the QR used by customers. The payload includes the business
              name, location (address), website, merchant signer, and challenge endpoint.
            </p>
          </div>
          <button
            onClick={loadOutlets}
            className="inline-flex items-center justify-center rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white/80 transition hover:border-white/40 hover:text-white"
          >
            {outletsLoading ? 'Refreshing…' : 'Reload Outlets'}
          </button>
        </div>

        {outletsLoading ? (
          <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-center text-slate-300">
            Loading registered outlets…
          </div>
        ) : outlets.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-center text-slate-300">
            {noOutletMessage}
          </div>
        ) : (
          <div className="mt-6 grid gap-4 lg:grid-cols-[0.55fr_0.45fr]">
            <div className="space-y-4">
              {outlets.map((outlet) => (
                <button
                  key={outlet.id}
                  type="button"
                  onClick={() => setSelectedOutletId(outlet.id)}
                  className={`w-full rounded-3xl border px-4 py-4 text-left transition ${
                    selectedOutletId === outlet.id
                      ? 'border-emerald-400/60 bg-emerald-400/10 shadow-lg shadow-emerald-500/20'
                      : 'border-white/10 bg-white/[0.02] hover:border-emerald-300/40 hover:bg-emerald-300/5'
                  }`}
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-lg font-semibold text-white">{outlet.name}</h4>
                      <span className="rounded-full border border-white/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-white/60">
                        Outlet #{outlet.id}
                      </span>
                    </div>
                    {outlet.location && (
                      <p className="text-sm text-slate-300">Address: {outlet.location}</p>
                    )}
                    {outlet.website && (
                      <p className="text-sm text-blue-200 underline decoration-dotted underline-offset-4">
                        {outlet.website}
                      </p>
                    )}
                    <p className="text-xs font-mono text-white/70">
                      Merchant: {outlet.merchant_address || 'Not set'}
                    </p>
                    <p className="text-xs text-white/60">
                      Challenge: {outlet.challenge_url || DEFAULT_CHALLENGE_URL}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-center shadow-inner shadow-indigo-900/30">
              <h4 className="text-lg font-semibold text-white">QR Preview</h4>
              {selectedOutlet && qrPayload ? (
                <div className="mt-4 flex flex-col items-center gap-4">
                  <div className="rounded-3xl bg-black/40 p-4 shadow-inner shadow-emerald-500/10 ring-1 ring-emerald-200/20">
                    <QRCode value={qrPayload} size={180} bgColor="#020617" fgColor="#34d399" />
                  </div>
                  <button
                    onClick={copyQrPayload}
                    className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white/80 transition hover:border-white/40 hover:text-white"
                  >
                    Copy QR Payload
                  </button>
                  <div className="rounded-2xl border border-white/10 bg-black/40 p-4 text-left text-xs text-slate-200">
                    <p className="font-semibold uppercase tracking-[0.3em] text-white/60">
                      Payload
                    </p>
                    <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-emerald-200">
                      {qrPayload}
                    </pre>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Customers scan this code to request stamps. After {STAMPS_PER_REWARD} stamps, the
                    contract automatically mints a reward token.
                  </p>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-300">
                  Select an outlet with a merchant signer and challenge URL to preview the QR.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <ConnectViaQR />
    </div>
  );
}


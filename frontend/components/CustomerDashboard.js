import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'react-toastify';
import { ethers } from 'ethers';
import QRCode from 'qrcode';
import { useWallet } from '../context/WalletContext';
import {
  buyCoffee,
  approveTokenSpending,
  getTokenAllowance,
  getTokenBalance,
  getRewardThreshold,
  getPendingRewards,
  getStampCount,
  getTotalVolume,
  getEventHistory,
  getLoyaltyContract,
} from '../lib/web3';
import { COFFEE_MENU } from '../constants/products';
import { BREW_TOKEN_SYMBOL, STAMPS_PER_REWARD } from '../lib/constants';

const formatEther = (value) => {
  try {
    return Number(ethers.formatUnits(value, 18)).toFixed(2);
  } catch (error) {
    return '0.00';
  }
};

const TOKEN_ADDRESS = process.env.NEXT_PUBLIC_TOKEN_ADDRESS || '';

const extractRpcError = (error) => {
  if (!error) {
    return 'Transaction failed';
  }

  const knownSources = [
    error.shortMessage,
    error.message,
    error?.info?.error?.message,
    error?.error?.message,
    error?.data?.message,
    error?.error?.data?.message,
    error?.reason,
  ].filter(Boolean);

  if (knownSources.length > 0) {
    return knownSources[0];
  }

  return 'Transaction failed';
};

export default function CustomerDashboard() {
  const {
    customerAddress,
    provider,
    customerSigner,
    isCorrectNetwork,
    ensureCorrectNetwork,
    expectedChainId,
  } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [tokenBalance, setTokenBalance] = useState(0n);
  const [stampCount, setStampCount] = useState(0);
  const [pendingRewards, setPendingRewards] = useState(0);
  const [totalVolume, setTotalVolume] = useState(0n);
  const [rewardThreshold, setRewardThreshold] = useState(STAMPS_PER_REWARD);
  const [events, setEvents] = useState([]);
  const [checkoutProduct, setCheckoutProduct] = useState(null);
  const [isCheckoutVisible, setIsCheckoutVisible] = useState(false);
  const [checkoutQr, setCheckoutQr] = useState('');
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);
  const [contractOwner, setContractOwner] = useState('');

  const isWalletConnected = Boolean(customerAddress);

  const sortedMenu = useMemo(() => COFFEE_MENU, []);

  useEffect(() => {
    if (!provider) {
      setContractOwner('');
      return;
    }
    let ignore = false;
    const resolveOwner = async () => {
      try {
        const contract = getLoyaltyContract(provider);
        const ownerAddress = await contract.owner();
        if (!ignore) {
          setContractOwner(ownerAddress);
        }
      } catch (error) {
        console.error('Failed to load CoffeeLoyalty owner address:', error);
        if (!ignore) {
          setContractOwner('');
        }
      }
    };
    resolveOwner();
    return () => {
      ignore = true;
    };
  }, [provider]);

  const refreshOnChainData = useCallback(async () => {
    if (!customerAddress || !provider) {
      setTokenBalance(0n);
      setStampCount(0);
      setPendingRewards(0);
      setTotalVolume(0n);
      setEvents([]);
      return;
    }

    try {
      setIsLoading(true);
      const [balance, stamps, rewards, volume, threshold, history] = await Promise.all([
        getTokenBalance(customerAddress, provider),
        getStampCount(customerAddress, provider),
        getPendingRewards(customerAddress, provider),
        getTotalVolume(customerAddress, provider),
        getRewardThreshold(provider),
        getEventHistory(customerAddress, provider),
      ]);
      setTokenBalance(balance);
      setStampCount(stamps);
      setPendingRewards(rewards);
      setTotalVolume(volume);
      if (threshold) {
        setRewardThreshold(threshold);
      }
      setEvents(history || []);
    } catch (error) {
      console.error('Failed to refresh customer data:', error);
      toast.error(error?.message || 'Unable to load loyalty data');
    } finally {
      setIsLoading(false);
    }
  }, [customerAddress, provider]);

  useEffect(() => {
    refreshOnChainData();
  }, [refreshOnChainData]);

  useEffect(() => {
    if (!isCheckoutVisible || !checkoutProduct) {
      setCheckoutQr('');
      return;
    }
    if (!contractOwner || !expectedChainId) {
      setCheckoutQr('');
      return;
    }

    const payload = {
      type: 'BWT_PURCHASE',
      to: contractOwner,
      amount: checkoutProduct.price,
      chainId: expectedChainId,
      tokenAddress: TOKEN_ADDRESS,
      tokenSymbol: BREW_TOKEN_SYMBOL,
      decimals: 18,
      product: {
        id: checkoutProduct.id,
        name: checkoutProduct.name,
        description: checkoutProduct.description,
        price: checkoutProduct.price,
      },
    };

    let cancelled = false;
    const generateQr = async () => {
      try {
        setIsGeneratingQr(true);
        const dataUrl = await QRCode.toDataURL(JSON.stringify(payload), {
          width: 240,
          margin: 2,
          color: {
            dark: '#0f172a',
            light: '#F8FAFC',
          },
        });
        if (!cancelled) {
          setCheckoutQr(dataUrl);
        }
      } catch (error) {
        console.error('Failed to generate checkout QR:', error);
        if (!cancelled) {
          setCheckoutQr('');
        }
      } finally {
        if (!cancelled) {
          setIsGeneratingQr(false);
        }
      }
    };

    generateQr();

    return () => {
      cancelled = true;
    };
  }, [isCheckoutVisible, checkoutProduct, contractOwner, expectedChainId]);

  const ensureAllowance = useCallback(
    async (amountWei) => {
      if (!customerAddress || !provider || !customerSigner) {
        throw new Error('Connect your wallet first.');
      }
      const allowance = await getTokenAllowance(customerAddress, process.env.NEXT_PUBLIC_LOYALTY_ADDRESS, provider);
      if (allowance >= amountWei) {
        return;
      }
      const approvalAmount = amountWei * 5n;
      await approveTokenSpending(process.env.NEXT_PUBLIC_LOYALTY_ADDRESS, approvalAmount, customerSigner);
      toast.success('Allowance approved for BrewToken spending.');
    },
    [customerAddress, provider, customerSigner]
  );

  const closeCheckout = useCallback(() => {
    setIsCheckoutVisible(false);
    setCheckoutProduct(null);
    setCheckoutQr('');
  }, []);

  const executePurchase = useCallback(
    async (product) => {
      if (!product) {
        toast.error('Select a coffee to purchase.');
        return;
      }
      if (!customerAddress || !customerSigner) {
        toast.error('Connect your wallet before purchasing.');
        return;
      }
      if (!isCorrectNetwork) {
        try {
          await ensureCorrectNetwork();
        } catch (error) {
          toast.error(error?.message || 'Network switch rejected.');
          return;
        }
      }

      const priceWei = ethers.parseUnits(product.price.toString(), 18);

    try {
      setIsPurchasing(true);
      await ensureAllowance(priceWei);

      const contract = getLoyaltyContract(customerSigner);
      try {
        await contract.buyCoffee.staticCall(customerAddress, priceWei);
      } catch (staticError) {
        const reason = extractRpcError(staticError);
        toast.error(reason || 'Purchase simulation failed. Check your balance and allowance.');
        setIsPurchasing(false);
        return;
      }

      const { hash, receipt } = await buyCoffee({ customerAddress, priceWei }, customerSigner);
      toast.success(`Purchased ${product.name}. Tx: ${hash.slice(0, 10)}…`);

      await fetch('/api/stamps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: customerAddress,
          productId: product.id,
          productName: product.name,
          priceBWT: product.price,
          txHash: hash,
          blockNumber: receipt?.blockNumber || null,
          metadata: { description: product.description },
        }),
      }).catch((error) => {
        console.error('Failed to sync purchase to Supabase', error);
      });

      await refreshOnChainData();
      closeCheckout();
    } catch (error) {
      console.error('Coffee purchase failed:', error);
      const friendlyMessage = extractRpcError(error);
      if (friendlyMessage.includes("doesn't have enough funds")) {
        toast.error(
          'Your wallet needs ETH on this network to cover gas. Transfer some test ETH from the merchant wallet and try again.'
        );
      } else if (friendlyMessage.includes('ERC20InsufficientBalance')) {
        toast.error(
          `You do not have enough ${BREW_TOKEN_SYMBOL} to cover this purchase. Ask the merchant to transfer tokens to your wallet.`
        );
      } else if (friendlyMessage.includes('ERC20: transfer amount exceeds allowance')) {
        toast.error(
          `Increase your BrewToken allowance for the loyalty contract and try again.`
        );
      } else {
        toast.error(friendlyMessage);
      }
      } finally {
      setIsPurchasing(false);
      }
    },
    [
      closeCheckout,
      customerAddress,
      customerSigner,
      ensureAllowance,
      ensureCorrectNetwork,
      isCorrectNetwork,
      refreshOnChainData,
    ]
  );

  const openCheckout = useCallback((product) => {
    setCheckoutProduct(product);
    setCheckoutQr('');
    setIsCheckoutVisible(true);
  }, []);

  const handleConfirmPurchase = useCallback(async () => {
    if (!checkoutProduct) {
      toast.error('Select a coffee to purchase.');
      return;
    }
    await executePurchase(checkoutProduct);
  }, [checkoutProduct, executePurchase]);

  const stampsNeeded = useMemo(() => {
    if (!rewardThreshold) return 0;
    const remainder = stampCount % rewardThreshold;
    return remainder === 0 ? rewardThreshold : rewardThreshold - remainder;
  }, [stampCount, rewardThreshold]);

  return (
    <>
      <div className="space-y-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-emerald-200">Coffee Loyalty</p>
            <h2 className="text-3xl font-semibold text-white sm:text-4xl">BrewToken Coffee Menu</h2>
            <p className="mt-2 text-sm text-slate-300">
              Browse coffees, pay with BrewToken, and let the CoffeeLoyalty contract handle stamps automatically.
            </p>
          </div>
          <div className="text-sm text-slate-300">
            {isWalletConnected ? (
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
                <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 font-semibold uppercase tracking-[0.4em] text-white">
                  Wallet {customerAddress.slice(0, 6)}…{customerAddress.slice(-4)}
                </span>
                <span className="rounded-full border border-purple-400/20 bg-purple-400/10 px-4 py-2 font-semibold uppercase tracking-[0.4em] text-purple-100">
                  Balance {formatEther(tokenBalance)} {BREW_TOKEN_SYMBOL}
                </span>
              </div>
            ) : (
              <p className="max-w-sm text-right text-xs text-slate-400 md:text-sm">
                Connect MetaMask to display your BrewToken balance, stamp progress, and reward history.
              </p>
            )}
          </div>
        </header>

        {isWalletConnected ? (
          <section className="grid gap-6 md:grid-cols-3">
            <div className="rounded-3xl border border-emerald-400/40 bg-emerald-400/10 p-6 shadow-xl shadow-emerald-900/40 backdrop-blur-2xl">
              <h3 className="text-xl font-semibold text-white">Stamp Progress</h3>
              <p className="mt-3 text-5xl font-bold text-emerald-100">
                {stampCount}/{rewardThreshold}
              </p>
              <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-emerald-300 to-cyan-300 transition-all duration-300"
                  style={{ width: `${Math.min((stampCount / rewardThreshold) * 100, 100)}%` }}
                />
              </div>
              <p className="mt-3 text-sm text-emerald-100/80">
                {stampsNeeded === rewardThreshold
                  ? 'Start collecting stamps with your next purchase.'
                  : `${stampsNeeded} more ${stampsNeeded === 1 ? 'stamp' : 'stamps'} until your next reward.`}
              </p>
            </div>

            <div className="rounded-3xl border border-purple-500/30 bg-purple-500/10 p-6 shadow-xl shadow-purple-900/40 backdrop-blur-2xl">
              <h3 className="text-xl font-semibold text-white">Pending Rewards</h3>
              <p className="mt-3 text-5xl font-bold text-purple-100">{pendingRewards}</p>
              {pendingRewards > 0 ? (
                <p className="mt-3 text-sm text-purple-100/80">
                  Show this screen to the barista to redeem your free drink. The merchant will verify it on-chain.
                </p>
              ) : (
                <p className="mt-3 text-sm text-purple-100/80">
                  Complete more purchases to earn free drinks. Rewards appear here once you hit {rewardThreshold}{' '}
                  stamps.
                </p>
              )}
            </div>

            <div className="rounded-3xl border border-blue-500/30 bg-blue-500/10 p-6 shadow-xl shadow-blue-900/40 backdrop-blur-2xl">
              <h3 className="text-xl font-semibold text-white">Lifetime Spend</h3>
              <p className="mt-3 text-4xl font-bold text-blue-100">
                {formatEther(totalVolume)} {BREW_TOKEN_SYMBOL}
              </p>
              <p className="mt-3 text-sm text-blue-100/80">
                Total BrewToken used for coffee purchases through this loyalty programme.
              </p>
            </div>
          </section>
        ) : (
          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-center text-sm text-slate-300 shadow-xl shadow-indigo-900/30 backdrop-blur-2xl">
            Connect your wallet to track stamp progress, pending rewards, and lifetime spend. You can still preview
            the menu and QR payment flow below.
          </section>
        )}

        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl shadow-indigo-900/30 backdrop-blur-2xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-emerald-200">Menu</p>
              <h3 className="text-2xl font-semibold text-white">Buy Coffee with BrewToken</h3>
              <p className="mt-2 text-sm text-slate-300">
                Each purchase adds one stamp automatically. Collect {rewardThreshold} stamps to unlock a free drink.
              </p>
            </div>
            <Link
              href="/customer/scan"
              className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/80 transition hover:border-white/40 hover:text-white"
            >
              Scan Merchant QR
            </Link>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sortedMenu.map((product) => (
              <div
                key={product.id}
                className="flex h-full flex-col rounded-3xl border border-white/10 bg-black/30 p-5 text-left shadow-lg shadow-slate-900/30"
              >
                <span className="text-xs uppercase tracking-[0.4em] text-white/40">Coffee</span>
                <span className="mt-2 text-lg font-semibold text-white">{product.name}</span>
                <p className="mt-2 text-xs text-slate-300">{product.description}</p>
                <span className="mt-4 text-sm font-semibold text-emerald-200">
                  {product.price} {BREW_TOKEN_SYMBOL}
                </span>
                <button
                  onClick={() => openCheckout(product)}
                  disabled={isPurchasing}
                  className="mt-4 inline-flex items-center justify-center rounded-full bg-gradient-to-r from-emerald-300 via-lime-300 to-sky-300 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-900 shadow-lg shadow-emerald-300/40 transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPurchasing ? 'Processing…' : 'Buy with MetaMask'}
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl shadow-indigo-900/30 backdrop-blur-2xl">
          <h3 className="text-2xl font-semibold text-white">Recent Activity</h3>
          {!isWalletConnected ? (
            <p className="mt-4 text-sm text-slate-300">Connect your wallet to view on-chain activity.</p>
          ) : isLoading ? (
            <p className="mt-4 text-sm text-slate-300">Loading purchase activity…</p>
          ) : events.length === 0 ? (
            <p className="mt-4 text-sm text-slate-300">No activity yet. Buy a coffee to get started.</p>
          ) : (
            <div className="mt-4 space-y-4">
              {events.slice(0, 10).map((event, index) => (
                <div
                  key={`${event.transactionHash}-${index}`}
                  className="flex flex-col rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-slate-200 shadow-inner shadow-slate-900/30"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="font-semibold uppercase tracking-[0.3em] text-white/60">
                      {event.type.replace('_', ' ').toUpperCase()}
                    </span>
                    <span className="text-xs uppercase tracking-[0.3em] text-white/40">
                      Block {event.blockNumber ?? '-'}
                    </span>
                  </div>
                  {event.type === 'purchase' ? (
                    <p className="mt-2 text-xs text-slate-300">
                      Purchase amount: {formatEther(event.price)} {BREW_TOKEN_SYMBOL}
                    </p>
                  ) : null}
                  {event.type === 'reward_redeemed' ? (
                    <p className="mt-2 text-xs text-slate-300">
                      Reward payout: {formatEther(event.payoutAmount)} {BREW_TOKEN_SYMBOL}
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs text-slate-400">
                    Tx: {event.transactionHash?.slice(0, 10)}…
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {event.timestamp ? new Date(event.timestamp).toLocaleString() : '-'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {isCheckoutVisible && checkoutProduct ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-8">
          <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-slate-950/95 p-6 shadow-[0_40px_120px_rgba(14,116,144,0.35)] backdrop-blur-2xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-emerald-200">Confirm Purchase</p>
                <h3 className="mt-2 text-2xl font-semibold text-white">{checkoutProduct.name}</h3>
                <p className="mt-2 text-sm text-slate-300">{checkoutProduct.description}</p>
              </div>
              <button
                type="button"
                onClick={closeCheckout}
                className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/40 hover:text-white"
              >
                Close
              </button>
            </div>

            <dl className="mt-6 grid gap-4 text-sm text-slate-200 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-[0.3em] text-white/60">Price</dt>
                <dd className="mt-1 text-xl font-semibold text-emerald-200">
                  {checkoutProduct.price} {BREW_TOKEN_SYMBOL}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.3em] text-white/60">Contract Owner</dt>
                <dd className="mt-1 font-mono text-xs text-white/80">
                  {contractOwner ? `${contractOwner.slice(0, 10)}…${contractOwner.slice(-6)}` : 'Resolving…'}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.3em] text-white/60">Chain</dt>
                <dd className="mt-1 text-xs text-white/80">Hardhat Local ({expectedChainId})</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.3em] text-white/60">Token</dt>
                <dd className="mt-1 font-mono text-xs text-white/80">
                  {TOKEN_ADDRESS ? `${TOKEN_ADDRESS.slice(0, 10)}…${TOKEN_ADDRESS.slice(-6)}` : 'Not configured'}
                </dd>
              </div>
            </dl>

            <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col items-center gap-3 rounded-3xl border border-white/10 bg-black/40 p-5">
                {checkoutQr ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={checkoutQr}
                    alt="BrewToken checkout QR"
                    className="h-44 w-44 rounded-2xl border border-white/10 bg-white/10 p-3 shadow-[0_30px_80px_-40px_rgba(59,130,246,0.8)]"
                  />
                ) : (
                  <div className="flex h-44 w-44 items-center justify-center rounded-2xl border border-dashed border-white/20 text-xs text-slate-300">
                    {isGeneratingQr ? 'Generating QR…' : 'QR will appear here.'}
                  </div>
                )}
                <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">
                  Scan with MetaMask Mobile to pay
                </p>
              </div>
              <div className="flex-1 text-sm text-slate-300 sm:pl-6">
                <p>
                  Tap <span className="font-semibold text-emerald-200">Buy with MetaMask</span> in this browser to
                  confirm the token transfer, or scan the QR with MetaMask Mobile and approve the payment on your
                  phone.
                </p>
                {!isWalletConnected ? (
                  <p className="mt-3 text-xs text-amber-300">
                    Connect your wallet to complete the transaction from this device. QR payments remain available.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={handleConfirmPurchase}
                disabled={!isWalletConnected || isPurchasing}
                className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-emerald-400 via-lime-300 to-sky-300 px-6 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-slate-900 shadow-lg shadow-emerald-400/40 transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPurchasing ? 'Processing…' : 'Confirm & Pay'}
              </button>
              <button
                type="button"
                onClick={closeCheckout}
                className="inline-flex items-center justify-center rounded-full border border-white/20 px-6 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/40 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}


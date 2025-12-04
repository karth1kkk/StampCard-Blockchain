import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { ethers } from 'ethers';
import { toast } from 'react-toastify';
import { AnimatePresence, motion } from 'framer-motion';
import QRModal from './QRModal';
import ReceiptModal from './ReceiptModal';
import FundPoolModal from './FundPoolModal';
import CustomerList from './CustomerList';
import PurchaseHistory from './PurchaseHistory';
import { BREW_TOKEN_ABI } from '../../lib/contractABI';
import {
  BREW_TOKEN_SYMBOL,
  MERCHANT_WALLET_ADDRESS,
  STAMPS_PER_REWARD,
  LOYALTY_CONTRACT_ADDRESS,
} from '../../lib/constants';
import { useWallet } from '../../context/WalletContext';
import {
  getPendingRewards,
  getStampCount,
  recordStampOnChain,
  fundRewardsOnChain,
  buyCoffee,
  approveTokenSpending,
  getTokenAllowance,
  getLoyaltyContract,
  getTokenBalance,
} from '../../lib/web3';
import { useInactivityTimer } from '../../hooks/useInactivityTimer';

const QrScanner = dynamic(
  () => import('@yudiel/react-qr-scanner').then((mod) => mod.QrScanner),
  { ssr: false }
);

const TOKEN_ADDRESS = process.env.NEXT_PUBLIC_TOKEN_ADDRESS || '';
const CHAIN_ID = process.env.NEXT_PUBLIC_CHAIN_ID || '';

const formatCurrency = (value) => {
  const numeric = Number(value || 0);
  if (Number.isNaN(numeric)) {
    return '0.00';
  }
  return numeric.toFixed(2);
};

const normaliseAddress = (value) => (value || '').trim().toLowerCase();
const shortenAddress = (value) =>
  value ? `${value.slice(0, 6)}…${value.slice(-4)}` : '';

export default function POSDashboard({ session, onSignOut, onSessionExpired }) {
  const {
    provider,
    customerSigner,
    ensureCorrectNetwork,
    isCorrectNetwork,
    isOwner,
    isConnecting,
    customerAddress,
    connectCustomerWallet,
    disconnectCustomerWallet,
    merchantAddress,
  } = useWallet();
  const [quantities, setQuantities] = useState({});
  const [customerWallet, setCustomerWallet] = useState('');
  const [customerWalletSynced, setCustomerWalletSynced] = useState(true);
  const [customerEmail, setCustomerEmail] = useState('');
  const [isQRVisible, setIsQRVisible] = useState(false);
  const [qrValue, setQrValue] = useState('');
  const [isWatchingPayment, setIsWatchingPayment] = useState(false);
  const [pendingOrder, setPendingOrder] = useState(null);
  const [lastTxHash, setLastTxHash] = useState('');
  const [lastBlockNumber, setLastBlockNumber] = useState(null);
  const [processingStamp, setProcessingStamp] = useState(false);
  const [sessionTimedOut, setSessionTimedOut] = useState(false);
  const [orderHistoryRefreshToken, setOrderHistoryRefreshToken] = useState(0);
  const [isCustomerPanelOpen, setIsCustomerPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('history'); // 'history' or 'customers'
  const [now, setNow] = useState(() => new Date());
  const [isFunding, setIsFunding] = useState(false);
  const [detectedTxHash, setDetectedTxHash] = useState('');
  const paymentWatcherRef = useRef(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [isReceiptVisible, setIsReceiptVisible] = useState(false);
  const [isFundPoolModalOpen, setIsFundPoolModalOpen] = useState(false);
  const [merchantDisplayName, setMerchantDisplayName] = useState('');
  const [coffeeMenu, setCoffeeMenu] = useState([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);

  const handleConnectMerchant = useCallback(async () => {
    try {
      await connectCustomerWallet();
      toast.success('Merchant wallet connected.');
    } catch (error) {
      // Don't show error for user rejections (code 4001)
      const isUserRejection = error?.code === 4001 || error?.message?.includes('User rejected');
      if (!isUserRejection) {
        toast.error(error?.message || 'Unable to connect wallet.');
      }
      // Silently handle user rejections - user intentionally cancelled
    }
  }, [connectCustomerWallet]);

  const handleDisconnectMerchant = useCallback(() => {
    disconnectCustomerWallet();
    toast.info('Merchant wallet disconnected.');
  }, [disconnectCustomerWallet]);

  useInactivityTimer({
    timeoutMs: 1 * 60 * 1000, // 1 minute
    onTimeout: () => {
      setSessionTimedOut(true);
      if (typeof onSessionExpired === 'function') {
        onSessionExpired();
      }
    },
    isEnabled: Boolean(session),
  });

  // Update time every second for real-time display
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch merchant display name from Supabase Auth user metadata
  useEffect(() => {
    if (!session?.user) {
      setMerchantDisplayName('');
      return;
    }

    // Try to get display name from session user metadata
    const displayName = 
      session?.user?.user_metadata?.display_name ||
      session?.user?.user_metadata?.displayName ||
      session?.user?.raw_user_meta_data?.display_name ||
      session?.user?.raw_user_meta_data?.displayName ||
      '';

    setMerchantDisplayName(displayName);
  }, [session?.user]);

  // Fetch products from database
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setIsLoadingProducts(true);
        const response = await fetch('/api/products');
        if (!response.ok) {
          throw new Error('Failed to fetch products');
        }
        const data = await response.json();
        setCoffeeMenu(data.products || []);
      } catch (error) {
        toast.error('Failed to load coffee menu');
      } finally {
        setIsLoadingProducts(false);
      }
    };

    fetchProducts();
  }, []);

const merchantContractAddress = useMemo(() => {
  const raw = MERCHANT_WALLET_ADDRESS || LOYALTY_CONTRACT_ADDRESS;
  if (!raw) {
    return '';
  }
  try {
    return ethers.getAddress(raw);
  } catch (error) {
    return raw;
  }
}, []);

  const orderItems = useMemo(() => {
    return Object.entries(quantities)
      .map(([productId, quantity]) => {
        const product = coffeeMenu.find((item) => item.id === productId);
        if (!product || quantity <= 0) {
          return null;
        }
        return {
          id: product.id,
          name: product.name,
          price: product.price,
          quantity,
        };
      })
      .filter(Boolean);
  }, [quantities]);

  const orderSummary = useMemo(() => {
    const totalWei = orderItems.reduce((acc, item) => {
      const priceWei = ethers.parseUnits(item.price, 18);
      return acc + priceWei * BigInt(item.quantity);
    }, 0n);
    const totalBwt = ethers.formatUnits(totalWei, 18);
    return {
      totalWei,
      totalBwt,
      displayTotal: formatCurrency(totalBwt),
      itemCount: orderItems.reduce((acc, item) => acc + item.quantity, 0),
    };
  }, [orderItems]);

  const resetOrder = useCallback(() => {
    setQuantities({});
    setPendingOrder(null);
    setIsWatchingPayment(false);
    setLastTxHash('');
    setLastBlockNumber(null);
  }, []);

  const updateQuantity = useCallback((productId, delta) => {
    setQuantities((prev) => {
      const nextQuantity = Math.max((prev[productId] || 0) + delta, 0);
      if (nextQuantity === 0) {
        const { [productId]: _removed, ...rest } = prev;
        return rest;
      }
      return {
        ...prev,
        [productId]: nextQuantity,
      };
    });
  }, []);

  const sanitizedCustomerWallet = useMemo(() => customerWallet.trim(), [customerWallet]);

  useEffect(() => {
    if (!customerAddress) {
      setCustomerWallet('');
      setCustomerWalletSynced(true);
      return;
    }
    if (customerWalletSynced) {
      setCustomerWallet(customerAddress);
    }
  }, [customerAddress, customerWalletSynced]);

  const canCreateQr =
    orderSummary.totalWei > 0n &&
    sanitizedCustomerWallet &&
    ethers.isAddress(sanitizedCustomerWallet);

  const canPayWithWallet =
    orderSummary.totalWei > 0n &&
    customerAddress &&
    ethers.isAddress(customerAddress);

  const extractRpcError = useCallback((error) => {
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
  }, []);

  const ensureAllowance = useCallback(
    async (amountWei, payerAddress, payerSigner) => {
      if (!payerAddress || !provider || !payerSigner) {
        throw new Error('Connect your wallet first.');
      }
      const LOYALTY_ADDRESS = process.env.NEXT_PUBLIC_LOYALTY_ADDRESS;
      if (!LOYALTY_ADDRESS) {
        throw new Error('Loyalty contract address not configured.');
      }
      const allowance = await getTokenAllowance(payerAddress, LOYALTY_ADDRESS, provider);
      if (allowance >= amountWei) {
        return;
      }
      const approvalAmount = amountWei * 5n;
      await approveTokenSpending(LOYALTY_ADDRESS, approvalAmount, payerSigner);
      toast.success('Allowance approved for BrewToken spending.');
    },
    [provider]
  );

  const handlePayWithWallet = useCallback(async () => {
    if (!canPayWithWallet) {
      toast.error('Select at least one item and connect your wallet to pay.');
      return;
    }
    if (!customerAddress || !customerSigner) {
      toast.error('Connect your wallet before paying.');
      return;
    }

    // Verify the signer address matches the customer address (required by buyCoffee contract)
    const signerAddress = await customerSigner.getAddress();
    if (signerAddress.toLowerCase() !== customerAddress.toLowerCase()) {
      toast.error('Connected wallet address does not match. Please reconnect your wallet.');
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

    const priceWei = orderSummary.totalWei;
    const customerWalletToUse = customerAddress;
    let tokenBalance = 0n;

    try {
      setIsPaying(true);

      // Check token balance first
      tokenBalance = await getTokenBalance(customerWalletToUse, provider);
      if (tokenBalance < priceWei) {
        const balanceFormatted = ethers.formatUnits(tokenBalance, 18);
        const priceFormatted = ethers.formatUnits(priceWei, 18);
        toast.error(
          `Insufficient balance. You have ${balanceFormatted} ${BREW_TOKEN_SYMBOL}, but need ${priceFormatted} ${BREW_TOKEN_SYMBOL}.`
        );
        setIsPaying(false);
        return;
      }

      // Check and approve allowance
      await ensureAllowance(priceWei, customerWalletToUse, customerSigner);

      // Verify allowance was set correctly (double-check)
      const LOYALTY_ADDRESS = process.env.NEXT_PUBLIC_LOYALTY_ADDRESS;
      if (!LOYALTY_ADDRESS) {
        throw new Error('Loyalty contract address not configured.');
      }
      const finalAllowance = await getTokenAllowance(customerWalletToUse, LOYALTY_ADDRESS, provider);
      if (finalAllowance < priceWei) {
        toast.error(
          `Allowance insufficient. Expected at least ${ethers.formatUnits(priceWei, 18)} ${BREW_TOKEN_SYMBOL}, but got ${ethers.formatUnits(finalAllowance, 18)} ${BREW_TOKEN_SYMBOL}. Please try again.`
        );
        setIsPaying(false);
        return;
      }

      // Verify balance again (in case something changed)
      const finalBalance = await getTokenBalance(customerWalletToUse, provider);
      if (finalBalance < priceWei) {
        toast.error(
          `Balance insufficient. Expected at least ${ethers.formatUnits(priceWei, 18)} ${BREW_TOKEN_SYMBOL}, but you have ${ethers.formatUnits(finalBalance, 18)} ${BREW_TOKEN_SYMBOL}.`
        );
        setIsPaying(false);
        return;
      }

      // Execute the purchase transaction
      const { hash, receipt } = await buyCoffee(
        { customerAddress: customerWalletToUse, priceWei },
        customerSigner
      );
      toast.success(`Payment sent. Tx: ${hash.slice(0, 10)}…`);

      // Update customer wallet field with the connected wallet
      setCustomerWallet(customerWalletToUse);
      setCustomerWalletSynced(true);

      // Note: buyCoffee automatically increments stamps on-chain (no need to call recordStampOnChain)
      // The receipt.wait() already ensures the transaction is confirmed
      // Add a brief delay to ensure contract state is propagated
      try {
        setProcessingStamp(true);
        
        // Brief delay to ensure contract state is updated (some RPC nodes need a moment)
        await new Promise((resolve) => setTimeout(resolve, 1500));
        
        // Fetch the on-chain stamp count and pending rewards to sync with database
        const provider = customerSigner.provider;
        
        // Verify transaction succeeded
        // In ethers.js v6, receipt.status is 1 for success, 0 for failure
        const receiptStatus = receipt?.status;
        if (receiptStatus === 0 || receiptStatus === 0n) {
          throw new Error('Transaction failed. Stamp was not recorded.');
        }
        
        // Retry logic: try up to 5 times with increasing delays to ensure we get updated state
        let stampCount = 0n;
        let pendingRewards = 0n;
        let retries = 0;
        const maxRetries = 5;
        let previousStampCount = 0n;
        
        while (retries < maxRetries) {
          try {
            const [fetchedStampCount, fetchedPendingRewards] = await Promise.all([
              getStampCount(customerWalletToUse, provider),
              getPendingRewards(customerWalletToUse, provider),
            ]);
            
            // Only update if we got a value that's different from previous (or if it's our first try)
            // This ensures we're getting the latest state
            if (fetchedStampCount > previousStampCount || retries === 0) {
              stampCount = fetchedStampCount;
              pendingRewards = fetchedPendingRewards;
              previousStampCount = fetchedStampCount;
              
              // If stamp count increased, we know the state is updated
              if (fetchedStampCount > 0n && retries > 0) {
                break;
              }
            }
            
            // If we're at max retries, use the latest values we got
            if (retries === maxRetries - 1) {
              stampCount = fetchedStampCount;
              pendingRewards = fetchedPendingRewards;
              break;
            }
            
            // Wait before next retry (exponential backoff: 1s, 2s, 3s, 4s)
            await new Promise((resolve) => setTimeout(resolve, 1000 * (retries + 1)));
            retries++;
          } catch (fetchError) {
            if (retries === maxRetries - 1) {
              // On final retry failure, throw error
              throw fetchError;
            }
            // Wait before retry
            await new Promise((resolve) => setTimeout(resolve, 1000 * (retries + 1)));
            retries++;
          }
        }
        
        // Critical check: If stamp count is still 0 after successful buyCoffee transaction,
        // this indicates the stamp wasn't added on-chain, which shouldn't happen
        // In this case, we need to ensure the database still gets updated with at least +1 stamp
        if (stampCount === 0n) {
          // Even though on-chain shows 0, buyCoffee should have added a stamp
          // We'll rely on the database to calculate the correct value from stampsAwarded
          // But first, let's try one more time after a longer delay
          try {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            const [finalStampCount, finalPendingRewards] = await Promise.all([
              getStampCount(customerWalletToUse, provider),
              getPendingRewards(customerWalletToUse, provider),
            ]);
            if (finalStampCount > 0n) {
              stampCount = finalStampCount;
              pendingRewards = finalPendingRewards;
            }
          } catch (finalError) {
            // Final fetch attempt failed - continue with current values
          }
        }

        // Sync to Supabase with on-chain values
        const syncResponse = await fetch('/api/stamps', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token || ''}`,
          },
          body: JSON.stringify({
            address: customerWalletToUse,
            email: customerEmail.trim() || null,
            totalBWT: orderSummary.totalBwt,
            items: orderItems,
            txHash: hash,
            blockNumber: receipt?.blockNumber || null,
            rewardThreshold: STAMPS_PER_REWARD,
            stampsAwarded: 1, // buyCoffee automatically adds 1 stamp
            pendingRewards: pendingRewards.toString(), // Use on-chain value as string
            stampCount: stampCount.toString(), // Use on-chain value as string
            merchantEmail: session?.user?.email || null,
            status: 'PAID',
            metadata: { 
              source: 'pos-dashboard', 
              paymentMethod: 'connected-wallet',
              onChainStampCount: stampCount.toString(),
              onChainPendingRewards: pendingRewards.toString(),
            },
          }),
        });

        if (!syncResponse.ok) {
          const errorData = await syncResponse.json().catch(() => ({}));
          throw new Error(errorData?.error || 'Failed to sync purchase to database');
        }

        const syncResult = await syncResponse.json();
        
        // Verify the database was updated correctly
        const dbStampCountNum = Number(syncResult.stamp_count);
        const onChainStampCountNum = Number(stampCount);
        if (dbStampCountNum !== onChainStampCountNum) {
          toast.error(`Warning: Database stamp count (${dbStampCountNum}) does not match on-chain (${onChainStampCountNum}). Please refresh the customer list.`);
        } else {
          
          // Check if customer reached full stamp card (8/8)
          const rewardThreshold = Number(syncResult.reward_threshold || STAMPS_PER_REWARD);
          if (dbStampCountNum === rewardThreshold) {
            const shortWallet = `${customerWalletToUse.slice(0, 6)}…${customerWalletToUse.slice(-4)}`;
            const handleToastClick = () => {
              setActiveTab('customers');
              setIsCustomerPanelOpen(true);
              // Scroll to customer after a short delay to allow panel to open
              setTimeout(() => {
                const customerElement = document.getElementById(`customer-${customerWalletToUse.toLowerCase()}`);
                if (customerElement) {
                  customerElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  // Highlight the row briefly
                  customerElement.classList.add('ring-2', 'ring-emerald-400', 'ring-offset-2');
                  setTimeout(() => {
                    customerElement.classList.remove('ring-2', 'ring-emerald-400', 'ring-offset-2');
                  }, 2000);
                }
              }, 300);
            };
            
            const toastId = toast.success(
              <div className="flex flex-col gap-1 cursor-pointer" onClick={handleToastClick}>
                <div className="font-semibold">🎉 Full Stamp Card!</div>
                <div className="text-sm">Customer {shortWallet} reached {rewardThreshold}/{rewardThreshold} stamps</div>
                <div className="text-xs text-white/70 mt-1">Click to view stamp card</div>
              </div>,
              {
                autoClose: 8000,
                onClick: handleToastClick,
              }
            );
          }
        }

        // Show receipt
        setReceiptData({
          items: orderItems,
          totalBWT: orderSummary.totalBwt,
          customerWallet: customerWalletToUse,
          customerEmail: customerEmail.trim() || null,
          merchantEmail: session?.user?.email || null,
          txHash: hash,
          blockNumber: receipt?.blockNumber || null,
          timestamp: new Date().toISOString(),
          paymentMethod: 'connected-wallet',
          stampsAwarded: 1,
          stampCount: Number(stampCount),
          pendingRewards: Number(pendingRewards),
        });
        setIsReceiptVisible(true);

        toast.success('Payment and stamp recorded successfully.');
        
        // Force immediate refresh of customer list to show updated stamp count
        // Use multiple mechanisms to ensure UI updates
        
        // 1. Immediate refresh token increment (forces CustomerList to re-render)
        setOrderHistoryRefreshToken((token) => token + 1);
        
        // 2. Additional delayed refreshes to catch any race conditions
        setTimeout(() => {
          setOrderHistoryRefreshToken((token) => token + 1);
        }, 2000);
        
        // 3. Another refresh after database propagation time
        setTimeout(() => {
          setOrderHistoryRefreshToken((token) => token + 1);
        }, 4000);
        
        resetOrder();
      } catch (syncError) {
        toast.error('Payment successful, but database sync failed. The stamp was recorded on-chain.');
        // Show receipt even if database sync failed - fetch on-chain values
        try {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          const [stampCount, pendingRewards] = await Promise.all([
            getStampCount(customerWalletToUse, customerSigner.provider),
            getPendingRewards(customerWalletToUse, customerSigner.provider),
          ]);
          setReceiptData({
            items: orderItems,
            totalBWT: orderSummary.totalBwt,
            customerWallet: customerWalletToUse,
            customerEmail: customerEmail.trim() || null,
            merchantEmail: session?.user?.email || null,
            txHash: hash,
            blockNumber: receipt?.blockNumber || null,
            timestamp: new Date().toISOString(),
            paymentMethod: 'connected-wallet',
            stampsAwarded: 1,
            stampCount: Number(stampCount),
            pendingRewards: Number(pendingRewards),
          });
        } catch (fetchError) {
          setReceiptData({
            items: orderItems,
            totalBWT: orderSummary.totalBwt,
            customerWallet: customerWalletToUse,
            customerEmail: customerEmail.trim() || null,
            merchantEmail: session?.user?.email || null,
            txHash: hash,
            blockNumber: receipt?.blockNumber || null,
            timestamp: new Date().toISOString(),
            paymentMethod: 'connected-wallet',
            stampsAwarded: 1,
            stampCount: 0,
            pendingRewards: 0,
          });
        }
        setIsReceiptVisible(true);
        resetOrder();
      } finally {
        setProcessingStamp(false);
      }
      
    } catch (error) {
      const errorMessage = error?.message || '';
      const errorData = error?.data || error?.error?.data || {};
      const friendlyMessage = extractRpcError(error);

      // Handle specific error cases
      if (friendlyMessage.includes("doesn't have enough funds") || friendlyMessage.includes('insufficient funds')) {
        toast.error('Your wallet needs ETH on this network to cover gas fees.');
      } else if (
        friendlyMessage.includes('ERC20InsufficientBalance') ||
        friendlyMessage.includes('insufficient balance')
      ) {
        toast.error(`You do not have enough ${BREW_TOKEN_SYMBOL} to cover this purchase.`);
      } else if (
        friendlyMessage.includes('ERC20: transfer amount exceeds allowance') ||
        friendlyMessage.includes('allowance')
      ) {
        toast.error('Token allowance issue. Please try again - the approval should have been completed.');
      } else if (friendlyMessage.includes('Caller must be customer')) {
        toast.error('Transaction must be sent from the customer wallet. Please ensure you are connected with the correct wallet.');
      } else if (friendlyMessage.includes('revert') || friendlyMessage.includes('execution reverted')) {
        // Try to extract the revert reason
        const revertReason = errorData?.message || errorMessage.match(/revert\s+(.+)/i)?.[1] || friendlyMessage;
        toast.error(`Transaction failed: ${revertReason}`);
      } else if (friendlyMessage.includes('Internal JSON-RPC error')) {
        toast.error('Transaction failed. Please check your token balance, allowance, and ensure you have enough ETH for gas.');
      } else {
        toast.error(friendlyMessage || 'Payment failed. Please try again.');
      }
    } finally {
      setIsPaying(false);
    }
  }, [
    canPayWithWallet,
    customerAddress,
    customerSigner,
    isCorrectNetwork,
    ensureCorrectNetwork,
    orderSummary,
    ensureAllowance,
    extractRpcError,
    isOwner,
    session,
    customerEmail,
    orderItems,
    resetOrder,
    provider,
  ]);

  const handleGenerateQr = useCallback(() => {
    const paymentRecipient = LOYALTY_CONTRACT_ADDRESS || MERCHANT_WALLET_ADDRESS;
    if (!TOKEN_ADDRESS || !paymentRecipient) {
      toast.error('Token or CoffeeLoyalty contract address is not configured.');
      return;
    }
    if (!canCreateQr) {
      toast.error('Select at least one item and provide a valid customer wallet.');
      return;
    }
    const amountWei = orderSummary.totalWei.toString();
    const chainSegment = CHAIN_ID ? `@${CHAIN_ID}` : '';
    const payload = `ethereum:${TOKEN_ADDRESS}${chainSegment}/transfer?address=${paymentRecipient}&uint256=${amountWei}`;
    setQrValue(payload);
    setIsQRVisible(true);
    setPendingOrder({
      totalWei: orderSummary.totalWei,
      totalBwt: orderSummary.totalBwt,
      items: orderItems,
      customerWallet: sanitizedCustomerWallet,
      customerEmail: customerEmail.trim() || null,
    });
    toast.info('QR ready. Awaiting customer payment…');
  }, [canCreateQr, sanitizedCustomerWallet, customerEmail, orderItems, orderSummary]);

  const notifyReward = useCallback(async (email, wallet) => {
    if (!email) {
      return;
    }
    try {
      await fetch('/api/rewards/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, wallet }),
      });
      toast.info(`Reward email sent to ${email}.`);
    } catch (error) {
      // Reward notification failed - continue silently
    }
  }, []);

  const handlePaymentConfirmed = useCallback(
    async ({ transactionHash, blockNumber }) => {
      if (!pendingOrder || !transactionHash) {
        return;
      }
      if (!customerSigner) {
        toast.error('Connect the merchant wallet in MetaMask to record the stamp.');
        return;
      }
      if (!isOwner) {
        toast.error('Connected wallet is not authorised to record stamps.');
        return;
      }
      try {
        if (!isCorrectNetwork) {
          await ensureCorrectNetwork();
        }
        setProcessingStamp(true);
        
        // Record stamp on-chain
        const { hash: stampTxHash, receipt: stampReceipt } = await recordStampOnChain(pendingOrder.customerWallet, customerSigner);
        
        // Brief delay to ensure contract state is propagated
        await new Promise((resolve) => setTimeout(resolve, 1500));
        
        // Fetch the on-chain stamp count and pending rewards to sync with database
        const provider = customerSigner.provider;
        
        // Verify transaction succeeded
        // In ethers.js v6, receipt.status is 1 for success, 0 for failure
        const stampReceiptStatus = stampReceipt?.status;
        if (stampReceiptStatus === 0 || stampReceiptStatus === 0n) {
          throw new Error('Stamp transaction failed. Stamp was not recorded.');
        }
        
        // Retry logic: try up to 5 times with increasing delays to ensure we get updated state
        let stampCount = 0n;
        let pendingRewards = 0n;
        let retries = 0;
        const maxRetries = 5;
        let previousStampCount = 0n;
        
        while (retries < maxRetries) {
          try {
            const [fetchedStampCount, fetchedPendingRewards] = await Promise.all([
              getStampCount(pendingOrder.customerWallet, provider),
              getPendingRewards(pendingOrder.customerWallet, provider),
            ]);
            
            // Only update if we got a value that's different from previous (or if it's our first try)
            // This ensures we're getting the latest state
            if (fetchedStampCount > previousStampCount || retries === 0) {
              stampCount = fetchedStampCount;
              pendingRewards = fetchedPendingRewards;
              previousStampCount = fetchedStampCount;
              
              // If stamp count increased, we know the state is updated
              if (fetchedStampCount > 0n && retries > 0) {
                break;
              }
            }
            
            // If we're at max retries, use the latest values we got
            if (retries === maxRetries - 1) {
              stampCount = fetchedStampCount;
              pendingRewards = fetchedPendingRewards;
              break;
            }
            
            // Wait before next retry (exponential backoff: 1s, 2s, 3s, 4s)
            await new Promise((resolve) => setTimeout(resolve, 1000 * (retries + 1)));
            retries++;
          } catch (fetchError) {
            if (retries === maxRetries - 1) {
              // On final retry failure, throw error
              throw fetchError;
            }
            // Wait before retry
            await new Promise((resolve) => setTimeout(resolve, 1000 * (retries + 1)));
            retries++;
          }
        }
        
        // Critical check: If stamp count is still 0 after successful recordStamp transaction,
        // this indicates the stamp wasn't added on-chain, which shouldn't happen
        // In this case, we need to ensure the database still gets updated with at least +1 stamp
        if (stampCount === 0n) {
          // Even though on-chain shows 0, recordStamp should have added a stamp
          // We'll rely on the database to calculate the correct value from stampsAwarded
          // But first, let's try one more time after a longer delay
          try {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            const [finalStampCount, finalPendingRewards] = await Promise.all([
              getStampCount(pendingOrder.customerWallet, provider),
              getPendingRewards(pendingOrder.customerWallet, provider),
            ]);
            if (finalStampCount > 0n) {
              stampCount = finalStampCount;
              pendingRewards = finalPendingRewards;
            }
          } catch (finalError) {
            // Final fetch attempt failed - continue with current values
          }
        }

        const response = await fetch('/api/stamps', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token || ''}`,
          },
          body: JSON.stringify({
            address: pendingOrder.customerWallet,
            email: pendingOrder.customerEmail,
            totalBWT: pendingOrder.totalBwt,
            items: pendingOrder.items,
            txHash: transactionHash, // Use payment tx hash
            blockNumber: blockNumber || stampReceipt?.blockNumber || null,
            rewardThreshold: STAMPS_PER_REWARD,
            stampsAwarded: 1,
            pendingRewards: pendingRewards.toString(), // Use on-chain value as string
            stampCount: stampCount.toString(), // Use on-chain value as string
            merchantEmail: session?.user?.email || null,
            status: 'PAID',
            metadata: { 
              source: 'pos-dashboard', 
              paymentMethod: 'qr-code', 
              stampTxHash: stampTxHash,
              onChainStampCount: stampCount.toString(),
              onChainPendingRewards: pendingRewards.toString(),
            },
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData?.error || 'Failed to sync purchase to database');
        }

        const payload = await response.json();
        
        // Verify the database was updated correctly
        const dbStampCountNum = Number(payload.stamp_count);
        const onChainStampCountNum = Number(stampCount);
        if (dbStampCountNum !== onChainStampCountNum) {
          toast.error(`Warning: Database stamp count (${dbStampCountNum}) does not match on-chain (${onChainStampCountNum}). Please refresh the customer list.`);
        } else {
          
          // Check if customer reached full stamp card (8/8)
          const rewardThreshold = Number(payload.reward_threshold || STAMPS_PER_REWARD);
          if (dbStampCountNum === rewardThreshold) {
            const customerWallet = pendingOrder.customerWallet;
            const shortWallet = `${customerWallet.slice(0, 6)}…${customerWallet.slice(-4)}`;
            const handleToastClick = () => {
              setActiveTab('customers');
              setIsCustomerPanelOpen(true);
              // Scroll to customer after a short delay to allow panel to open
              setTimeout(() => {
                const customerElement = document.getElementById(`customer-${customerWallet.toLowerCase()}`);
                if (customerElement) {
                  customerElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  // Highlight the row briefly
                  customerElement.classList.add('ring-2', 'ring-emerald-400', 'ring-offset-2');
                  setTimeout(() => {
                    customerElement.classList.remove('ring-2', 'ring-emerald-400', 'ring-offset-2');
                  }, 2000);
                }
              }, 300);
            };
            
            const toastId = toast.success(
              <div className="flex flex-col gap-1 cursor-pointer" onClick={handleToastClick}>
                <div className="font-semibold">🎉 Full Stamp Card!</div>
                <div className="text-sm">Customer {shortWallet} reached {rewardThreshold}/{rewardThreshold} stamps</div>
                <div className="text-xs text-white/70 mt-1">Click to view stamp card</div>
              </div>,
              {
                autoClose: 8000,
                onClick: handleToastClick,
              }
            );
          }
        }

        toast.success('Stamp recorded successfully.');
        
        // Show receipt
        setReceiptData({
          items: pendingOrder.items || [],
          totalBWT: pendingOrder.totalBwt,
          customerWallet: pendingOrder.customerWallet,
          customerEmail: pendingOrder.customerEmail || null,
          merchantEmail: session?.user?.email || null,
          txHash: transactionHash,
          blockNumber: blockNumber || null,
          timestamp: new Date().toISOString(),
          paymentMethod: 'qr-code',
          stampsAwarded: 1,
          stampCount: Number(stampCount),
          pendingRewards: Number(pendingRewards),
        });
        setIsReceiptVisible(true);
        
        // Force immediate refresh of customer list to show updated stamp count
        
        // 1. Immediate refresh token increment (forces CustomerList to re-render)
        setOrderHistoryRefreshToken((token) => token + 1);
        
        // 2. Additional delayed refreshes to catch any race conditions
        setTimeout(() => {
          setOrderHistoryRefreshToken((token) => token + 1);
        }, 2000);
        
        // 3. Another refresh after database propagation time
        setTimeout(() => {
          setOrderHistoryRefreshToken((token) => token + 1);
        }, 4000);
        
        resetOrder();

        if (!payload?.rewardEligible && pendingRewards > 0) {
          payload.rewardEligible = true;
        }

        if (payload?.rewardEligible) {
          await notifyReward(payload.email, pendingOrder.customerWallet);
        }
      } catch (error) {
        const message =
          error?.shortMessage ||
          error?.reason ||
          error?.message ||
          'Unable to record stamp.';
        toast.error(message);
      } finally {
        setProcessingStamp(false);
      }
    },
    [
      customerSigner,
      ensureCorrectNetwork,
      isCorrectNetwork,
      isOwner,
      pendingOrder,
      resetOrder,
      session?.access_token,
      session?.user?.email,
      notifyReward,
    ]
  );

  const handleSessionModalClose = useCallback(() => {
    setSessionTimedOut(false);
    resetOrder();
  }, [resetOrder]);

  useEffect(() => {
    if (!isQRVisible || !pendingOrder || !provider || !TOKEN_ADDRESS) {
      return () => {};
    }

    const tokenContract = new ethers.Contract(TOKEN_ADDRESS, BREW_TOKEN_ABI, provider);
    const targetAmount = pendingOrder.totalWei;
    const targetCustomer = normaliseAddress(pendingOrder.customerWallet);
    const targetMerchant =
      LOYALTY_CONTRACT_ADDRESS || MERCHANT_WALLET_ADDRESS || null;
    if (!targetMerchant) {
      return () => {};
    }

    const handler = (from, to, value, event) => {
      if (!event?.transactionHash) {
        return;
      }
      if (normaliseAddress(to) !== targetMerchant) {
        return;
      }
      if (targetCustomer && normaliseAddress(from) !== targetCustomer) {
        return;
      }
      if (value !== targetAmount) {
        return;
      }

      toast.success('Payment detected on-chain. Recording stamp…');
      setIsQRVisible(false);
      setIsWatchingPayment(false);
      setLastTxHash(event.transactionHash);
      setLastBlockNumber(event.blockNumber ?? null);
      handlePaymentConfirmed({
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber ?? null,
        from: normaliseAddress(from),
      });
      tokenContract.off('Transfer', handler);
    };

    tokenContract.on('Transfer', handler);
    paymentWatcherRef.current = () => {
      tokenContract.off('Transfer', handler);
    };
    setIsWatchingPayment(true);

    return () => {
      tokenContract.off('Transfer', handler);
      paymentWatcherRef.current = null;
    };
  }, [handlePaymentConfirmed, isQRVisible, pendingOrder, provider]);

  useEffect(() => {
    return () => {
      if (paymentWatcherRef.current) {
        paymentWatcherRef.current();
      }
    };
  }, []);

  const handleFundRewards = useCallback(() => {
    if (!customerSigner) {
      toast.error('Connect the wallet first.');
      return;
    }
    if (!isOwner) {
      toast.error('Only the contract owner can fund the reward pool.');
      return;
    }
    setIsFundPoolModalOpen(true);
  }, [customerSigner, isOwner]);

  const headerTime = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-950 text-white">
      <aside className="hidden w-[300px] flex-col border-r border-white/5 bg-white/[0.02] px-6 py-6 shadow-xl shadow-black/40 lg:flex">
        <div>
          <p className="text-[10px] uppercase tracking-[0.45em] text-white/40">BrewToken POS</p>
          <h1 className="mt-3 text-2xl font-semibold text-white">Coffee Bar</h1>
          <p className="mt-2 text-xs text-slate-300">
            Process BrewToken orders, accept mobile payments, and issue loyalty stamps from one screen.
          </p>
        </div>

        <div className="mt-8 space-y-4 rounded-3xl border border-white/10 bg-black/30 p-5">
          <div>
            <p className="text-[10px] uppercase tracking-[0.35em] text-white/40">Merchant session</p>
            <p className="mt-2 font-mono text-sm text-emerald-200">
              {merchantDisplayName || session?.user?.email || '—'}
            </p>
            {/* <p className="mt-1 text-[10px] uppercase tracking-[0.4em] text-emerald-200/70">
              Auto logout after 2 min idle
            </p> */}
          </div>
          <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-[10px] uppercase tracking-[0.35em] text-white/50">Connected wallet</p>
            {merchantContractAddress ? (
              <p className="font-mono text-xs text-emerald-200">
                {shortenAddress(merchantContractAddress)}
              </p>
            ) : (
              <p className="text-xs text-red-200">Contract address not configured.</p>
            )}
          </div>
          <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-[10px] uppercase tracking-[0.35em] text-white/50">Operator wallet</p>
            {customerAddress ? (
              <>
                <p className="font-mono text-xs text-slate-100">{shortenAddress(customerAddress)}</p>
                <p className="text-[10px] uppercase tracking-[0.4em] text-emerald-200/80">
                  {isOwner ? 'Owner verified' : 'Not contract owner'}
                </p>
              </>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-slate-300">
                  Connect the owner wallet to redeem rewards and fund the pool.
                </p>
                {merchantAddress && (
                  <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-2">
                    <p className="text-[10px] uppercase tracking-[0.3em] text-amber-200/80 mb-1">
                      Contract Owner
                    </p>
                    <p className="font-mono text-xs text-amber-100 break-all">
                      {merchantAddress}
                    </p>
                    <p className="text-[10px] text-amber-200/70 mt-1">
                      Connect this wallet to redeem rewards
                    </p>
                  </div>
                )}
              </div>
            )}
            {!customerAddress && (
              <button
                type="button"
                onClick={handleConnectMerchant}
                disabled={isConnecting}
                className="mt-3 w-full rounded-full border border-emerald-300/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-100 transition hover:border-emerald-200 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isConnecting ? 'Connecting…' : 'Connect Wallet'}
              </button>
            )}
            {customerAddress ? (
              <button
                type="button"
                onClick={handleDisconnectMerchant}
                className="mt-3 w-full rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/40 hover:text-white"
              >
                Disconnect
              </button>
            ) : null}
          </div>
          {/* <button
            type="button"
            onClick={() => {
              setActiveTab('customers');
              setIsCustomerPanelOpen(true);
            }}
            className="w-full rounded-3xl border border-white/10 bg-white/[0.08] px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white/90 transition hover:border-emerald-200 hover:bg-emerald-400/10"
          >
            Customer Directory
          </button> */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('history');
              setIsCustomerPanelOpen(true);
            }}
            className="w-full rounded-3xl border border-blue-400/30 bg-blue-400/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-blue-200 transition hover:border-blue-300 hover:bg-blue-400/20"
          >
            Purchase History
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 bg-white/[0.03] px-6 py-4 shadow-lg shadow-black/30">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.45em] text-white/40">Live orders</p>
              <h2 className="text-3xl font-semibold text-white">Counter</h2>
            </div>
            <div className="hidden sm:flex sm:flex-col">
              <span className="text-xs uppercase tracking-[0.35em] text-white/40">Local time</span>
              <span className="text-lg font-semibold text-white">{headerTime}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab('customers');
                setIsCustomerPanelOpen(true);
              }}
              className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/80 transition hover:border-white/30 hover:text-white"
            >
              Customers
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('history');
                setIsCustomerPanelOpen(true);
              }}
              className="rounded-full border border-blue-400/30 bg-blue-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-blue-200 transition hover:border-blue-300 hover:text-blue-100"
            >
              Orders
            </button>
            {isOwner && (
              <button
                type="button"
                onClick={handleFundRewards}
                disabled={isConnecting || isFunding}
                className="rounded-full border border-emerald-400/30 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-200 transition hover:border-emerald-200 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isFunding ? 'Funding…' : 'Fund Pool'}
              </button>
            )}
            {/* <button
              type="button"
              onClick={() => {
                resetOrder();
                connectCustomerWallet().catch(() => {});
              }}
              className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/80 transition hover:border-white/30 hover:text-white"
            >
              Refresh Wallet
            </button> */}
            <button
              type="button"
              onClick={() => {
                if (typeof onSignOut === 'function') {
                  onSignOut();
                }
              }}
              className="rounded-full border border-red-400/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-red-100 transition hover:border-red-300 hover:text-white"
            >
              Sign out
            </button>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          <section className="flex-1 overflow-y-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.45em] text-white/40">Menu</p>
                <h3 className="mt-2 text-xl font-semibold text-white">Coffee selection</h3>
              </div>
              <div className="rounded-full border border-white/10 px-4 py-1 text-xs uppercase tracking-[0.35em] text-white/70">
                {orderSummary.itemCount} item(s)
              </div>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {coffeeMenu.map((item) => {
                const quantity = quantities[item.id] || 0;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => updateQuantity(item.id, 1)}
                    className="group relative flex h-full flex-col justify-between overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-black text-left transition hover:border-emerald-300/60 hover:shadow-lg hover:shadow-emerald-500/20"
                  >
                    <div className="absolute inset-0 -z-10 bg-gradient-to-br from-emerald-400/0 via-emerald-400/10 to-sky-400/0 opacity-0 transition group-hover:opacity-100" />
                    {/* Product Image */}
                    <div className="relative h-40 w-full overflow-hidden">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                        onError={(e) => {
                          e.target.src = 'https://via.placeholder.com/400x400/1e293b/64748b?text=' + encodeURIComponent(item.name);
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-black/0" />
                    </div>
                    <div className="flex flex-1 flex-col justify-between p-6">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.35em] text-white/50">Add to order</p>
                        <h3 className="mt-3 text-lg font-semibold text-white">{item.name}</h3>
                        <p className="mt-2 text-sm text-slate-300">{item.description}</p>
                      </div>
                      <div className="mt-6 flex items-center justify-between text-sm text-emerald-200">
                        <span>{item.price} {BREW_TOKEN_SYMBOL}</span>
                        {quantity > 0 ? (
                          <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-semibold text-emerald-100">
                            x{quantity}
                          </span>
                        ) : (
                          <span className="text-xs uppercase tracking-[0.35em] text-emerald-100/70">
                            tap to add
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="relative flex w-full max-w-md flex-col border-l border-white/5 bg-white/[0.03] px-6 py-6 shadow-[-20px_0_40px_rgba(10,10,20,0.35)]">
            {/* Payment Processing Loader Overlay */}
            {(isPaying || processingStamp) && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm rounded-r-3xl">
                <div className="flex flex-col items-center gap-4">
                  <div className="relative">
                    <div className="h-16 w-16 animate-spin rounded-full border-4 border-emerald-300/30 border-t-emerald-400"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="h-8 w-8 rounded-full bg-emerald-400/20"></div>
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-white">
                      {isPaying ? 'Processing Payment...' : 'Recording Stamp...'}
                    </p>
                    <p className="mt-1 text-xs text-slate-300">
                      Please wait while we process your transaction
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <p className="text-[10px] uppercase tracking-[0.4em] text-white/40">Current order</p>
              <h3 className="mt-2 text-xl font-semibold text-white">Summary</h3>
            </div>

            <div className="mt-5 flex-1 overflow-y-auto">
              {orderItems.length === 0 ? (
                <p className="text-sm text-slate-300">Select drinks to start building the order.</p>
              ) : (
                <div className="space-y-3">
                  {orderItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-slate-200"
                    >
                      <div>
                        <p className="font-semibold text-white">{item.name}</p>
                        <p className="text-xs text-slate-400">
                          {item.price} {BREW_TOKEN_SYMBOL} · Qty {item.quantity}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/40 hover:text-white"
                          onClick={() => updateQuantity(item.id, -1)}
                        >
                          −
                        </button>
                        <span className="text-lg font-semibold text-white">{item.quantity}</span>
                        <button
                          type="button"
                          className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/40 hover:text-white"
                          onClick={() => updateQuantity(item.id, 1)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6 space-y-4 border-t border-white/10 pt-4 text-sm text-slate-200">
              <label className="block text-[10px] font-semibold uppercase tracking-[0.35em] text-white/50">
                Customer Wallet
                <div className="mt-2 flex gap-2">
                  <input
                    value={customerWallet}
                    onChange={(event) => {
                      const next = event.target.value;
                      setCustomerWallet(next);
                      if (customerAddress && next.trim() !== customerAddress) {
                        setCustomerWalletSynced(false);
                      } else {
                        setCustomerWalletSynced(true);
                      }
                    }}
                    placeholder="0x…"
                    className="flex-1 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-300/70 focus:ring-1 focus:ring-emerald-300/50"
                  />
                  {/* <button
                    type="button"
                    onClick={() => setIsScannerOpen(true)}
                    className="rounded-2xl border border-white/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-emerald-200 hover:text-white"
                  >
                    Scan QR
                  </button> */}
                </div>
              </label>
              {/* <label className="block text-[10px] font-semibold uppercase tracking-[0.35em] text-white/50">
                Customer Email (optional)
                <input
                  value={customerEmail}
                  onChange={(event) => setCustomerEmail(event.target.value)}
                  placeholder="customer@example.com"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-300/70 focus:ring-1 focus:ring-emerald-300/50"
                />
              </label> */}
            </div>

            <div className="mt-6 space-y-3 border-t border-white/10 pt-4">
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.35em] text-white/50">
                <span>Total ({BREW_TOKEN_SYMBOL})</span>
                <span className="text-3xl font-semibold text-white">{orderSummary.displayTotal}</span>
              </div>
              {canPayWithWallet && (
                <button
                  type="button"
                  onClick={handlePayWithWallet}
                  disabled={isPaying || processingStamp || isConnecting || isWatchingPayment}
                  className="w-full rounded-full bg-gradient-to-r from-emerald-400 via-lime-300 to-sky-300 px-6 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-slate-900 shadow-lg shadow-emerald-300/40 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPaying
                    ? 'Processing Payment…'
                    : processingStamp
                    ? 'Recording Stamp…'
                    : 'Pay with Connected Wallet'}
                </button>
              )}
              {!canPayWithWallet && orderSummary.totalWei > 0n && (
                <p className="text-center text-xs text-slate-400 py-2">
                  Connect wallet to pay directly
                </p>
              )}
              {/* {canCreateQr && (
                <button
                  type="button"
                  onClick={handleGenerateQr}
                  disabled={processingStamp || isConnecting || isWatchingPayment}
                  className="w-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 px-6 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white shadow-lg shadow-indigo-500/40 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isWatchingPayment
                    ? 'Awaiting Payment…'
                    : processingStamp
                    ? 'Recording Stamp…'
                    : 'Generate Payment QR'}
                </button>
              )}
              {!canCreateQr && orderSummary.totalWei > 0n && (
                <p className="text-center text-xs text-slate-400 py-2">
                  Enter customer wallet address to generate QR
                </p>
              )} */}
              <div className="grid grid-cols-1">
                <button
                  type="button"
                  onClick={resetOrder}
                  className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/30 hover:text-white"
                >
                  Clear Order
                </button>
              </div>
            </div>

            {lastTxHash ? (
              <div className="mt-6 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-xs text-emerald-100">
                <p className="font-semibold uppercase tracking-[0.3em]">Last payment</p>
                <p className="mt-2 font-mono text-sm">
                  Tx: {lastTxHash.slice(0, 10)}…{lastTxHash.slice(-8)}
                </p>
                {lastBlockNumber ? (
                  <p className="mt-1 text-xs text-emerald-200/80">Block #{lastBlockNumber}</p>
                ) : null}
              </div>
            ) : null}
          </section>
        </div>
      </div>

      <AnimatePresence>
        {isCustomerPanelOpen ? (
          <motion.div
            className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/80 px-4 pt-6 pb-6 backdrop-blur"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="relative w-full max-w-5xl max-h-[85vh] overflow-y-auto rounded-t-3xl border border-white/10 bg-slate-950/95 p-6 shadow-2xl shadow-black/40"
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
            >
              <div className="mb-6 flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('history')}
                    className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] transition ${
                      activeTab === 'history'
                        ? 'bg-blue-400/20 text-blue-200 border border-blue-400/40'
                        : 'border border-white/15 text-white/60 hover:border-white/30 hover:text-white'
                    }`}
                  >
                    Purchase History
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('customers')}
                    className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] transition ${
                      activeTab === 'customers'
                        ? 'bg-blue-400/20 text-blue-200 border border-blue-400/40'
                        : 'border border-white/15 text-white/60 hover:border-white/30 hover:text-white'
                    }`}
                  >
                    Customers
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCustomerPanelOpen(false)}
                  className="rounded-full border border-white/15 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-white/80 transition hover:border-white/30 hover:text-white"
                >
                  Close
                </button>
              </div>
              {activeTab === 'history' ? (
                <PurchaseHistory
                  key={orderHistoryRefreshToken}
                  accessToken={session?.access_token}
                  refreshToken={orderHistoryRefreshToken}
                  onReceiptClick={(receiptData) => {
                    setReceiptData(receiptData);
                    setIsReceiptVisible(true);
                  }}
                />
              ) : (
                <CustomerList
                  key={orderHistoryRefreshToken}
                  accessToken={session?.access_token}
                  refreshToken={orderHistoryRefreshToken}
                  onRefreshRequested={() => setOrderHistoryRefreshToken((token) => token + 1)}
                />
              )}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <QRModal
        isOpen={isQRVisible}
        onClose={() => setIsQRVisible(false)}
        payload={qrValue}
        totalBwt={orderSummary.displayTotal}
        customerWallet={sanitizedCustomerWallet}
      />
      <ReceiptModal
        isOpen={isReceiptVisible}
        onClose={() => {
          setIsReceiptVisible(false);
          setReceiptData(null);
        }}
        receiptData={receiptData}
      />
      <FundPoolModal
        isOpen={isFundPoolModalOpen}
        onClose={() => setIsFundPoolModalOpen(false)}
        signer={customerSigner}
        provider={provider}
        customerAddress="0xE4e68F1fEB1Bd1B3035E1cEC0cFE0C657D2f4fF9"
      />
      <AnimatePresence>
        {isScannerOpen ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 px-4 py-6 backdrop-blur"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/95 p-6 shadow-2xl shadow-black/50"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              <div className="space-y-4 text-sm text-slate-200">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.35em] text-white/50">
                      Scan customer wallet
                    </p>
                    <h3 className="mt-2 text-xl font-semibold text-white">MetaMask QR</h3>
                    <p className="mt-2 text-xs text-slate-300">
                      Point the camera at the customer’s MetaMask QR code to capture their wallet address instantly.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsScannerOpen(false)}
                    className="rounded-full border border-white/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/60 transition hover:border-white/40 hover:text-white"
                  >
                    Close
                  </button>
                </div>
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/50">
                  <QrScanner
                    onDecode={(result) => {
                      const text = typeof result === 'string' ? result : result?.text || result?.rawValue || '';
                      const match = text.match(/0x[a-fA-F0-9]{40}/);
                      if (!match) {
                        return;
                      }
                      try {
                        const checksum = ethers.getAddress(match[0]);
                        setCustomerWallet(checksum);
                        setCustomerWalletSynced(false);
                        toast.success(`Detected wallet ${shortenAddress(checksum)}`);
                        setIsScannerOpen(false);
                      } catch (error) {
                        toast.error('Scanned QR does not contain a valid wallet address.');
                      }
                    }}
                    onError={() => {
                      // QR scan error - continue silently
                    }}
                    containerStyle={{ paddingBottom: '0', height: '280px' }}
                    videoStyle={{ borderRadius: '16px' }}
                  />
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {sessionTimedOut ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 px-4 py-6 backdrop-blur"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-sm rounded-3xl border border-white/10 bg-slate-900/90 p-8 shadow-2xl shadow-black/40"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              <h2 className="text-2xl font-semibold text-white">Session expired</h2>
              <p className="mt-3 text-sm text-slate-300">
                You were signed out after 2 minutes of inactivity. Please log in again to continue using the POS.
              </p>
              <button
                type="button"
                onClick={handleSessionModalClose}
                className="mt-6 w-full rounded-full border border-white/10 px-6 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white/80 transition hover:border-white/30 hover:text-white"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

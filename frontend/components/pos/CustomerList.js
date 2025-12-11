import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { ethers } from 'ethers';
import { useWallet } from '../../context/WalletContext';
import { redeemRewardOnChain, getPendingRewards, getRewardTokenAmount, getTokenContract, getStampCount } from '../../lib/web3';
import StampCard from './StampCard';
import VoucherSelectionModal from './VoucherSelectionModal';

export default function CustomerList({ accessToken, onRefreshRequested, refreshToken, onVoucherSelected }) {
  const { customerSigner, ensureCorrectNetwork, isCorrectNetwork, isConnecting, isOwner, customerAddress, merchantAddress } = useWallet();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [redeemingWallet, setRedeemingWallet] = useState('');
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [pendingRedemptionWallet, setPendingRedemptionWallet] = useState(null);

  const fetchCustomers = useCallback(async () => {
    if (!accessToken) {
      return;
    }
    setLoading(true);
    try {
      // Add cache-busting query parameter to ensure fresh data
      const cacheBuster = `?scope=all&_t=${Date.now()}`;
      const response = await fetch(`/api/customers${cacheBuster}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: 'no-store', // Ensure no caching
      });
      if (!response.ok) {
        throw new Error((await response.json())?.error || 'Unable to load customer list');
      }
      const payload = await response.json();
      const customersList = payload.customers || [];
      
      // Create a new array reference to ensure React detects the change
      const newCustomers = customersList.map(c => ({ ...c }));
      setCustomers(newCustomers);
    } catch (error) {
      console.error('Customer list error:', error);
      toast.error(error?.message || 'Unable to load customers');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }
    fetchCustomers();
  }, [refreshToken, accessToken]);

  // Set up polling to refresh customer list every 3 seconds
  useEffect(() => {
    if (!accessToken) {
      return;
    }
    
    const interval = setInterval(() => {
      fetchCustomers();
    }, 3000);
    
    return () => clearInterval(interval);
  }, [accessToken, fetchCustomers, refreshToken]);

  const totalStats = useMemo(() => {
    return customers.reduce(
      (acc, customer) => {
        const stamps = Number(customer.stamp_count || 0);
        const pendingRewards = Number(customer.pending_rewards || 0);
        const lifetime = Number(customer.lifetime_stamps || 0);
        acc.totalStamps += stamps;
        acc.pendingRewards += pendingRewards;
        acc.lifetimeStamps += lifetime;
        return acc;
      },
      { totalStamps: 0, pendingRewards: 0, lifetimeStamps: 0 }
    );
  }, [customers]);

  const handleRedeemClick = useCallback(
    async (walletAddress) => {
      if (!walletAddress) {
        return;
      }
      
      if (!customerSigner) {
        toast.error('Please connect your wallet first.');
        return;
      }

      // Get the actual signer address immediately to verify authorization
      let signerAddress;
      try {
        signerAddress = await customerSigner.getAddress();
        console.log('[Redemption Check] Signer address:', signerAddress);
        console.log('[Redemption Check] Target wallet address:', walletAddress);
        console.log('[Redemption Check] Is owner:', isOwner);
      } catch (error) {
        toast.error('Unable to get wallet address. Please reconnect your wallet.');
        return;
      }

      // Normalize addresses for comparison
      const normalizedSigner = signerAddress.toLowerCase();
      const normalizedTarget = walletAddress.toLowerCase();
      
      // Check if customer is redeeming their own reward
      const isCustomerRedeeming = normalizedSigner === normalizedTarget;
      
      // Verify authorization: must be either the customer themselves OR the owner
      if (!isCustomerRedeeming && !isOwner) {
        toast.error(
          `Authorization failed. Connected wallet (${signerAddress.slice(0, 6)}…${signerAddress.slice(-4)}) is not the customer (${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}) and is not the contract owner. Only the customer or contract owner can redeem rewards.`
        );
        return;
      }

      const provider = customerSigner.provider;
      
      // Verify on-chain pending rewards before showing voucher modal
      try {
        if (!isCorrectNetwork) {
          await ensureCorrectNetwork();
        }

        const onChainPendingRewards = await getPendingRewards(walletAddress, provider);
        console.log('[Redemption Check] On-chain pending rewards:', onChainPendingRewards.toString());
        
        // Find customer in database to compare
        const customerData = customers.find(
          (c) => (c.customer_wallet || c.wallet_address)?.toLowerCase() === walletAddress.toLowerCase()
        );
        const dbPendingRewards = customerData ? Number(customerData.pending_rewards || 0) : 0;
        console.log('[Redemption Check] Database pending rewards:', dbPendingRewards);
        
        if (onChainPendingRewards === 0n) {
          // Show detailed error if database shows rewards but on-chain doesn't
          if (dbPendingRewards > 0) {
            toast.error(
              `Database shows ${dbPendingRewards} pending reward(s), but on-chain shows 0. The database is out of sync. The reward may have already been redeemed. Please refresh the page.`,
              { autoClose: 10000 }
            );
          } else {
            toast.error('No pending rewards found on-chain for this customer.');
          }
          return;
        }

        // NOTE: For voucher redemptions, we skip the reward pool check because vouchers are free drinks
        // and don't require BWT token transfers. The contract will still update on-chain state
        // (decrement pending rewards), but if rewardTokenAmount > 0 and pool is empty, the contract
        // will revert. We handle this gracefully in the error handler.
        // 
        // If you want to enable BWT token rewards instead of vouchers, uncomment the check below:
        /*
        const rewardTokenAmount = await getRewardTokenAmount(provider);
        if (rewardTokenAmount > 0n) {
          const LOYALTY_ADDRESS = process.env.NEXT_PUBLIC_LOYALTY_ADDRESS;
          if (!LOYALTY_ADDRESS) {
            toast.error('Loyalty contract address not configured.');
            return;
          }
          const tokenContract = getTokenContract(provider);
          const rewardPoolBalance = await tokenContract.balanceOf(LOYALTY_ADDRESS);
          if (rewardPoolBalance < rewardTokenAmount) {
            const requiredAmount = ethers.formatUnits(rewardTokenAmount, 18);
            const availableAmount = ethers.formatUnits(rewardPoolBalance, 18);
            const shortAddress = `${LOYALTY_ADDRESS.slice(0, 6)}…${LOYALTY_ADDRESS.slice(-4)}`;
            toast.error(
              `The reward pool (contract ${shortAddress}) is empty. Required: ${requiredAmount} BWT, Available: ${availableAmount} BWT. The contract needs BWT tokens to pay rewards. Use the "Fund Pool" button in the POS dashboard to transfer BWT to the contract.`,
              { autoClose: 8000 }
            );
            return;
          }
        }
        */

        // Show voucher selection modal
        setPendingRedemptionWallet(walletAddress);
        setShowVoucherModal(true);
      } catch (error) {
        console.error('Error checking redemption eligibility:', error);
        toast.error('Unable to check redemption eligibility. Please try again.');
      }
    },
    [customerSigner, ensureCorrectNetwork, isCorrectNetwork, isOwner, customers]
  );

  const handleVoucherSelected = useCallback(
    async (voucher) => {
      if (!pendingRedemptionWallet) {
        return;
      }

      const walletAddress = pendingRedemptionWallet;
      const provider = customerSigner?.provider;
      
      if (!customerSigner) {
        toast.error('Please connect your wallet first.');
        setShowVoucherModal(false);
        setPendingRedemptionWallet(null);
        return;
      }

      // Get the actual address from the signer to verify it matches
      let signerAddress;
      try {
        signerAddress = await customerSigner.getAddress();
        console.log('[Redemption] Signer address:', signerAddress);
        console.log('[Redemption] Target wallet address:', walletAddress);
        console.log('[Redemption] Context customerAddress:', customerAddress);
        console.log('[Redemption] Is owner:', isOwner);
      } catch (error) {
        toast.error('Unable to get wallet address. Please reconnect your wallet.');
        setShowVoucherModal(false);
        setPendingRedemptionWallet(null);
        return;
      }

      // Check if customer is redeeming their own reward
      const isCustomerRedeeming = signerAddress.toLowerCase() === walletAddress.toLowerCase();
      console.log('[Redemption] Is customer redeeming own reward:', isCustomerRedeeming);
      
      // Determine which signer to use and verify authorization
      let signerToUse = customerSigner;
      let authorizationError = null;
      
      if (isCustomerRedeeming) {
        // Customer redeeming their own reward - signer must match customer address
        if (signerAddress.toLowerCase() !== walletAddress.toLowerCase()) {
          authorizationError = `Wallet mismatch. Connected: ${signerAddress.slice(0, 6)}…${signerAddress.slice(-4)}, but trying to redeem for: ${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}. Please connect the correct wallet.`;
        }
      } else {
        // Owner redeeming for customer - signer must be the owner
        if (!isOwner) {
          authorizationError = `Connected wallet (${signerAddress.slice(0, 6)}…${signerAddress.slice(-4)}) is not the contract owner. Only the contract owner can redeem rewards for other customers.`;
        }
      }

      if (authorizationError) {
        toast.error(authorizationError);
        setShowVoucherModal(false);
        setPendingRedemptionWallet(null);
        return;
      }

      try {
        if (!isCorrectNetwork) {
          await ensureCorrectNetwork();
        }

        // CRITICAL: Double-check on-chain pending rewards right before redemption
        // This prevents the transaction from failing due to database/blockchain sync issues
        const finalOnChainCheck = await getPendingRewards(walletAddress, provider);
        console.log('[Redemption] Final on-chain pending rewards check:', finalOnChainCheck.toString());
        
        if (finalOnChainCheck === 0n) {
          // Database shows pending rewards but on-chain doesn't - sync issue
          toast.error(
            `Database shows pending rewards, but on-chain shows 0. The database is out of sync. Please refresh the customer list. If the issue persists, the reward may have already been redeemed.`,
            { autoClose: 10000 }
          );
          setShowVoucherModal(false);
          setPendingRedemptionWallet(null);
          
          // Try to sync the database by fetching current on-chain state
          try {
            const [onChainStampCount, onChainPendingRewards] = await Promise.all([
              getStampCount(walletAddress, provider),
              getPendingRewards(walletAddress, provider),
            ]);
            
            // Update database to match on-chain state
            await fetch('/api/stamps', {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify({
                address: walletAddress,
                stampCount: Number(onChainStampCount),
                pendingRewards: Number(onChainPendingRewards),
              }),
            }).catch((error) => {
              console.error('Failed to sync database with on-chain state:', error);
            });
            
            // Refresh customer list to show updated state
            await fetchCustomers();
            if (typeof onRefreshRequested === 'function') {
              onRefreshRequested();
            }
          } catch (syncError) {
            console.error('Error syncing database:', syncError);
          }
          
          return;
        }

        setRedeemingWallet(walletAddress);
        setShowVoucherModal(false);
        
        // Attempt redemption
        const { hash, receipt } = await redeemRewardOnChain(walletAddress, signerToUse);
        toast.success(
          `Reward redeemed for ${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)} — tx ${hash.slice(0, 10)}…`
        );
        
        // Fetch on-chain values after redemption to sync with database
        const rewardTokenAmount = await getRewardTokenAmount(provider);
        try {
          const [onChainStampCount, onChainPendingRewards] = await Promise.all([
            getStampCount(walletAddress, provider),
            getPendingRewards(walletAddress, provider),
          ]);

          // Sync to Supabase with on-chain values
          await fetch('/api/stamps', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              address: walletAddress,
              txHash: hash,
              blockNumber: receipt?.blockNumber || null,
              rewardAmountBWT: rewardTokenAmount > 0n ? ethers.formatUnits(rewardTokenAmount, 18) : null,
              stampCount: Number(onChainStampCount),
              pendingRewards: Number(onChainPendingRewards),
            }),
          }).catch((error) => {
            console.error('Failed to sync reward redemption to Supabase:', error);
            toast.warning('Redemption successful on-chain, but database sync failed. The database may be out of sync.');
          });
        } catch (syncError) {
          console.error('Failed to fetch on-chain values after redemption:', syncError);
          // Still try to update database without on-chain values
          await fetch('/api/stamps', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              address: walletAddress,
              txHash: hash,
              blockNumber: receipt?.blockNumber || null,
              rewardAmountBWT: rewardTokenAmount > 0n ? ethers.formatUnits(rewardTokenAmount, 18) : null,
            }),
          }).catch((error) => {
            console.error('Failed to sync reward redemption to Supabase:', error);
            toast.warning('Redemption successful on-chain, but database sync failed.');
          });
        }
        
        // Add voucher to POS checkout
        if (typeof onVoucherSelected === 'function') {
          onVoucherSelected({
            ...voucher,
            price: 0, // Voucher items are free
            quantity: 1,
            isVoucher: true,
          });
        }
        
        // Refresh customer list
        await fetchCustomers();
        if (typeof onRefreshRequested === 'function') {
          onRefreshRequested();
        }
      } catch (error) {
        console.error('Reward redemption failed:', error);
        
        // Extract detailed error message
        let errorMessage = 'Unable to redeem reward';
        if (error?.shortMessage) {
          errorMessage = error.shortMessage;
        } else if (error?.reason) {
          errorMessage = error.reason;
        } else if (error?.message) {
          errorMessage = error.message;
        } else if (error?.data?.message) {
          errorMessage = error.data.message;
        } else if (error?.error?.message) {
          errorMessage = error.error.message;
        }

        // Provide specific error messages for common issues
        if (errorMessage.includes('No rewards pending') || errorMessage.includes('No rewards')) {
          errorMessage = 'No pending rewards found on-chain for this customer. The database may be out of sync.';
        } else if (errorMessage.includes('Insufficient reward pool') || errorMessage.includes('Insufficient')) {
          // For voucher redemptions, the contract tries to transfer BWT tokens if rewardTokenAmount > 0.
          // If the pool is empty, the contract reverts. Since vouchers are free drinks (not BWT transfers),
          // we'll record the redemption in the database manually and proceed with the voucher.
          console.warn('On-chain redemption failed due to empty reward pool. Recording voucher redemption in database instead.');
          
          try {
            // Get current on-chain state before manual update
            const [currentStampCount, currentPendingRewards] = await Promise.all([
              getStampCount(walletAddress, provider),
              getPendingRewards(walletAddress, provider),
            ]);
            
            // Manually record the voucher redemption in database
            // Decrement pending rewards by 1, reset stamp count to 0 (as contract would do)
            const newPendingRewards = Math.max(0, Number(currentPendingRewards) - 1);
            
            await fetch('/api/stamps', {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify({
                address: walletAddress,
                txHash: null, // No on-chain transaction
                blockNumber: null,
                rewardAmountBWT: 0, // Vouchers don't transfer BWT
                stampCount: 0, // Contract resets to 0 on redemption
                pendingRewards: newPendingRewards,
              }),
            });
            
            // Add voucher to POS checkout
            if (typeof onVoucherSelected === 'function') {
              onVoucherSelected({
                ...voucher,
                price: 0, // Voucher items are free
                quantity: 1,
                isVoucher: true,
              });
            }
            
            // Refresh customer list
            await fetchCustomers();
            if (typeof onRefreshRequested === 'function') {
              onRefreshRequested();
            }
            
            toast.success(
              `Voucher redeemed successfully! The reward pool was empty, so this was recorded as a free drink voucher (no BWT transfer). The voucher has been added to your POS checkout.`
            );
            
            // Clear redemption state
            setRedeemingWallet('');
            setPendingRedemptionWallet(null);
            return; // Exit early since we handled it manually
          } catch (dbError) {
            console.error('Failed to record voucher redemption in database:', dbError);
            errorMessage = 'On-chain redemption failed due to empty reward pool, and database update also failed. Please try again or fund the reward pool.';
          }
        } else if (errorMessage.includes('not authorised') || errorMessage.includes('not the owner') || errorMessage.includes('Only owner or customer')) {
          // Get signer address for error message
          let currentSignerAddr = 'unknown';
          try {
            const currentSigner = await signerToUse.getAddress();
            currentSignerAddr = currentSigner;
          } catch (e) {
            // Fallback to stored signerAddress if available
            if (signerAddress) {
              currentSignerAddr = signerAddress;
            }
          }
          const targetAddr = walletAddress;
          const ownerAddr = merchantAddress || 'unknown';
          
          // Show detailed error with all addresses
          console.error('[Redemption Error] Address mismatch:', {
            signerAddress: currentSignerAddr,
            targetCustomer: targetAddr,
            contractOwner: ownerAddr,
            isCustomerRedeeming,
            isOwner,
          });
          
          errorMessage = `Authorization failed! Connected wallet (${currentSignerAddr.slice(0, 6)}…${currentSignerAddr.slice(-4)}) must be either the customer (${targetAddr.slice(0, 6)}…${targetAddr.slice(-4)}) or the contract owner (${ownerAddr !== 'unknown' ? `${ownerAddr.slice(0, 6)}…${ownerAddr.slice(-4)}` : 'unknown'}). Check console for details.`;
        } else if (errorMessage.includes('execution reverted')) {
          errorMessage = 'Transaction reverted. Check that the customer has pending rewards and the reward pool is funded.';
        }

        toast.error(errorMessage);
      } finally {
        setRedeemingWallet('');
        setPendingRedemptionWallet(null);
      }
    },
    [
      accessToken,
      customerAddress,
      customerSigner,
      ensureCorrectNetwork,
      fetchCustomers,
      isCorrectNetwork,
      isOwner,
      onRefreshRequested,
      onVoucherSelected,
      pendingRedemptionWallet,
    ]
  );

  return (
    <section className="mt-12 rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl shadow-indigo-900/30 backdrop-blur-2xl">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-white/50">Loyalty Overview</p>
          <h3 className="text-2xl font-semibold text-white">Customer Rewards</h3>
          <p className="mt-1 text-sm text-slate-300">
            Track stamp progress, pending rewards, and lifetime BrewToken orders.
          </p>
          {!isOwner && (
            <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3">
              <p className="text-xs font-semibold text-amber-200 mb-2">
                ⚠️ Owner Wallet Required
              </p>
              <p className="text-xs text-amber-100/90 mb-2">
                To redeem rewards, you must connect the wallet that owns the CoffeeLoyalty contract.
              </p>
              {merchantAddress && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-amber-200/80">
                    <span className="font-semibold">Contract Owner:</span>{' '}
                    <span className="font-mono">{merchantAddress.slice(0, 10)}…{merchantAddress.slice(-8)}</span>
                  </p>
                  {customerAddress && (
                    <p className="text-xs text-amber-200/80">
                      <span className="font-semibold">Connected Wallet:</span>{' '}
                      <span className="font-mono">{customerAddress.slice(0, 10)}…{customerAddress.slice(-8)}</span>
                    </p>
                  )}
                  {!customerAddress && (
                    <p className="text-xs text-amber-200/80">
                      <span className="font-semibold">Status:</span> No wallet connected
                    </p>
                  )}
                </div>
              )}
              {!merchantAddress && (
                <p className="text-xs text-amber-100/80">
                  Unable to fetch contract owner address. Make sure the contract is deployed and the RPC is connected.
                </p>
              )}
              <p className="text-xs text-amber-100/80 mt-2">
                <span className="font-semibold">How to fix:</span> Import the deployer wallet (the one that deployed the contract) into MetaMask and connect it. 
                This is typically the first account from Hardhat (check your deployment output for the deployer address).
              </p>
            </div>
          )}
          {isOwner && customerAddress && merchantAddress && (
            <div className="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3">
              <p className="text-xs font-semibold text-emerald-200">
                ✅ Owner Wallet Connected
              </p>
              <p className="text-xs text-emerald-100/90 mt-1">
                You can redeem rewards for customers. Connected as:{' '}
                <span className="font-mono">{customerAddress.slice(0, 10)}…{customerAddress.slice(-8)}</span>
              </p>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={fetchCustomers}
            disabled={loading || !accessToken}
            className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <div className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 text-xs text-emerald-200">
            <span className="uppercase tracking-[0.3em]">Pending rewards:</span>{' '}
            <span>{totalStats.pendingRewards}</span>
          </div>
        </div>
      </header>

      {customers.length === 0 ? (
        <p className="mt-6 text-sm text-slate-300">
          {loading ? 'Loading customers…' : 'No customer orders yet.'}
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10 text-sm text-slate-200">
            <caption className="pb-4 text-left text-xs uppercase tracking-[0.3em] text-white/40">
              Total stamps: {totalStats.totalStamps} · Pending rewards: {totalStats.pendingRewards} ·
              Lifetime stamps: {totalStats.lifetimeStamps}
            </caption>
            <thead>
              <tr className="text-left text-xs uppercase tracking-[0.3em] text-white/50">
                <th className="px-4 py-2">Customer</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Stamp Card</th>
                <th className="px-4 py-2">Pending Rewards</th>
                <th className="px-4 py-2">Reward Eligible</th>
                <th className="px-4 py-2">Last Updated</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {customers.map((customer) => {
                  const wallet = customer.customer_wallet || customer.wallet_address;
                  const pending = Number(customer.pending_rewards || 0);
                  const rewardEligible = customer.reward_eligible || pending > 0;
                  
                  const stampCount = Number(customer.stamp_count ?? 0);
                  const lifetimeStamps = Number(customer.lifetime_stamps ?? 0);
                  const rewardThreshold = Number(customer.reward_threshold ?? process.env.NEXT_PUBLIC_REWARD_THRESHOLD ?? 8);
                  const lastUpdated = customer.last_updated
                    ? new Date(customer.last_updated).toLocaleString()
                    : '—';
                  const shortWallet = wallet
                    ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}`
                    : 'Unknown';
                  
                  const cardsCompleted = pending;
                  const currentCardNumber = cardsCompleted + 1;
                  
                  return (
                    <tr key={wallet} id={`customer-${wallet.toLowerCase()}`}>
                      <td className="px-4 py-3 font-mono text-xs text-slate-100">{shortWallet}</td>
                      <td className="px-4 py-3 text-xs text-slate-300">{customer.email || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="w-64">
                          <StampCard
                            key={`${wallet}-stamp${stampCount}-pending${pending}-updated${lastUpdated}`}
                            stampCount={stampCount}
                            pendingRewards={pending}
                            rewardThreshold={rewardThreshold}
                            cardsCompleted={cardsCompleted}
                            currentCardNumber={currentCardNumber}
                            lifetimeStamps={lifetimeStamps}
                          />
                        </div>
                      </td>
                    <td className="px-4 py-3">{pending}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] ${
                          rewardEligible
                            ? 'bg-emerald-400/10 text-emerald-200'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {rewardEligible ? 'Ready' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{lastUpdated}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        disabled={
                          pending <= 0 ||
                          !rewardEligible ||
                          isConnecting ||
                          redeemingWallet === wallet ||
                          !accessToken
                        }
                        onClick={() => handleRedeemClick(wallet)}
                        className="rounded-full border border-emerald-400/40 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-100 transition hover:border-emerald-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                        title={
                          pending <= 0
                            ? 'No pending rewards'
                            : customerAddress && customerAddress.toLowerCase() === wallet.toLowerCase()
                            ? 'Redeem your own reward'
                            : isOwner
                            ? 'Redeem reward for this customer'
                            : 'Only the contract owner or the customer themselves can redeem rewards'
                        }
                      >
                        {redeemingWallet === wallet ? 'Redeeming…' : 'Redeem Reward'}
                      </button>
                    </td>
                  </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}

      <VoucherSelectionModal
        isOpen={showVoucherModal}
        onClose={() => {
          setShowVoucherModal(false);
          setPendingRedemptionWallet(null);
        }}
        onSelect={handleVoucherSelected}
      />
    </section>
  );
}



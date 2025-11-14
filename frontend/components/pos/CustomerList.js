import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { ethers } from 'ethers';
import { useWallet } from '../../context/WalletContext';
import { redeemRewardOnChain, getPendingRewards, getRewardTokenAmount, getTokenContract, getStampCount } from '../../lib/web3';
import StampCard from './StampCard';

export default function CustomerList({ accessToken, onRefreshRequested, refreshToken }) {
  const { customerSigner, ensureCorrectNetwork, isCorrectNetwork, isConnecting, isOwner, customerAddress, merchantAddress } = useWallet();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [redeemingWallet, setRedeemingWallet] = useState('');

  const fetchCustomers = useCallback(async () => {
    if (!accessToken) {
      return;
    }
    setLoading(true);
    try {
      const response = await fetch('/api/customers?scope=all', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (!response.ok) {
        throw new Error((await response.json())?.error || 'Unable to load customer list');
      }
      const payload = await response.json();
      const customersList = payload.customers || [];
      console.log('CustomerList: Fetched customers:', {
        count: customersList.length,
        timestamp: new Date().toISOString(),
        customers: customersList.map((c) => ({
          wallet: c.customer_wallet || c.wallet_address,
          stampCount: c.stamp_count,
          pendingRewards: c.pending_rewards,
          rewardThreshold: c.reward_threshold,
          lifetimeStamps: c.lifetime_stamps,
          email: c.email,
        })),
      });
      setCustomers(customersList);
    } catch (error) {
      console.error('Customer list error:', error);
      toast.error(error?.message || 'Unable to load customers');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers, refreshToken]); // Also refresh when refreshToken changes

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

  const handleRedeem = useCallback(
    async (walletAddress) => {
      if (!walletAddress) {
        return;
      }
      if (!customerSigner) {
        toast.error('Connect the merchant wallet in MetaMask to redeem rewards.');
        return;
      }
      if (!isOwner) {
        toast.error('Connected wallet is not authorised to redeem rewards. Only the contract owner can redeem rewards.');
        return;
      }
      
      const provider = customerSigner.provider;
      if (!provider) {
        toast.error('Provider not available. Please reconnect your wallet.');
        return;
      }

      try {
        if (!isCorrectNetwork) {
          await ensureCorrectNetwork();
        }

        // Verify on-chain pending rewards before attempting redemption
        const onChainPendingRewards = await getPendingRewards(walletAddress, provider);
        const onChainStampCount = await getStampCount(walletAddress, provider);
        
        // Find the customer in the current list to show database values
        const customerData = customers.find(
          (c) => (c.customer_wallet || c.wallet_address)?.toLowerCase() === walletAddress.toLowerCase()
        );
        const dbPendingRewards = customerData ? Number(customerData.pending_rewards || 0) : 0;
        const dbStampCount = customerData ? Number(customerData.stamp_count || 0) : 0;
        
        if (onChainPendingRewards === 0) {
          // Show detailed sync mismatch information
          const syncInfo = `Database: ${dbPendingRewards} pending, ${dbStampCount} stamps | On-chain: ${onChainPendingRewards} pending, ${onChainStampCount} stamps`;
          console.warn('Reward sync mismatch:', {
            wallet: walletAddress,
            database: { pendingRewards: dbPendingRewards, stampCount: dbStampCount },
            onChain: { pendingRewards: onChainPendingRewards, stampCount: onChainStampCount },
          });
          
          const errorDetails = [
            `No pending rewards found on-chain for this customer.`,
            ``,
            `Database Status:`,
            `  • Pending Rewards: ${dbPendingRewards}`,
            `  • Stamp Count: ${dbStampCount}`,
            ``,
            `On-Chain Status:`,
            `  • Pending Rewards: ${onChainPendingRewards}`,
            `  • Stamp Count: ${onChainStampCount}`,
            ``,
            dbStampCount !== onChainStampCount
              ? `⚠️ Stamp counts differ! This suggests stamps were recorded in the database but not on-chain.`
              : `⚠️ The database shows ${dbPendingRewards} pending reward${dbPendingRewards !== 1 ? 's' : ''}, but the contract shows ${onChainPendingRewards}.`,
            ``,
            `Solution: Make sure to record stamps on-chain after each purchase using the "Record Stamp" function.`,
          ].join('\n');
          
          toast.error(errorDetails, { autoClose: 10000 });
          await fetchCustomers();
          return;
        }

        // Check reward pool balance
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

        setRedeemingWallet(walletAddress);
        
        // Attempt redemption
        const { hash, receipt } = await redeemRewardOnChain(walletAddress, customerSigner);
        toast.success(
          `Reward redeemed for ${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)} — tx ${hash.slice(0, 10)}…`
        );
        
        // Fetch on-chain values after redemption to sync with database
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
          errorMessage = 'Insufficient reward pool balance. Please fund the reward pool first using the "Fund Pool" button.';
        } else if (errorMessage.includes('not authorised') || errorMessage.includes('not the owner')) {
          errorMessage = 'Connected wallet is not the contract owner. Only the owner can redeem rewards.';
        } else if (errorMessage.includes('execution reverted')) {
          errorMessage = 'Transaction reverted. Check that the customer has pending rewards and the reward pool is funded.';
        }

        toast.error(errorMessage);
      } finally {
        setRedeemingWallet('');
      }
    },
    [
      accessToken,
      customerSigner,
      ensureCorrectNetwork,
      fetchCustomers,
      isCorrectNetwork,
      isOwner,
      onRefreshRequested,
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
              {(() => {
                // Deduplicate customers by wallet address (keep the most recent one)
                const uniqueCustomers = new Map();
                customers.forEach((customer) => {
                  const wallet = (customer.customer_wallet || customer.wallet_address)?.toLowerCase();
                  if (!wallet) return;
                  
                  const existing = uniqueCustomers.get(wallet);
                  if (!existing || new Date(customer.last_updated || 0) > new Date(existing.last_updated || 0)) {
                    uniqueCustomers.set(wallet, customer);
                  }
                });
                
                return Array.from(uniqueCustomers.values()).map((customer) => {
                  const wallet = customer.customer_wallet || customer.wallet_address;
                  const pending = Number(customer.pending_rewards || 0);
                  const rewardEligible = customer.reward_eligible || pending > 0;
                  const stampCount = Number(customer.stamp_count || 0);
                  const lifetimeStamps = Number(customer.lifetime_stamps || 0);
                  const rewardThreshold = Number(customer.reward_threshold || process.env.NEXT_PUBLIC_REWARD_THRESHOLD || 8);
                  const lastUpdated = customer.last_updated
                    ? new Date(customer.last_updated).toLocaleString()
                    : '—';
                  const shortWallet = wallet
                    ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}`
                    : 'Unknown';
                  
                  // Calculate which card number they're on (1st, 2nd, 3rd, etc.)
                  // Cards completed = pending rewards
                  // Current card number = cards completed + 1
                  const cardsCompleted = pending;
                  const currentCardNumber = cardsCompleted + 1;
                  
                  return (
                    <tr key={wallet}>
                      <td className="px-4 py-3 font-mono text-xs text-slate-100">{shortWallet}</td>
                      <td className="px-4 py-3 text-xs text-slate-300">{customer.email || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="w-64">
                          <StampCard
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
                          !accessToken ||
                          !isOwner
                        }
                        onClick={() => handleRedeem(wallet)}
                        className="rounded-full border border-emerald-400/40 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-100 transition hover:border-emerald-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                        title={
                          !isOwner
                            ? 'Connect the contract owner wallet to redeem rewards'
                            : pending <= 0
                            ? 'No pending rewards'
                            : 'Redeem reward for this customer'
                        }
                      >
                        {redeemingWallet === wallet ? 'Redeeming…' : 'Redeem Reward'}
                      </button>
                    </td>
                  </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}



import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const DEFAULT_REWARD_THRESHOLD = Number(process.env.REWARD_THRESHOLD || process.env.NEXT_PUBLIC_REWARD_THRESHOLD || 8);

let supabase = null;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
} else {
  console.warn('Supabase credentials not found. Database operations will be limited.');
}

const requireSupabase = () => {
  if (!supabase) {
    throw new Error('Supabase client is not initialised');
  }
  return supabase;
};

const normaliseAddress = (address) => (typeof address === 'string' ? address.toLowerCase() : '').trim();

const parseNumeric = (value) => {
  if (value === null || value === undefined) {
    return 0;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const isMissingColumn = (error) => error?.code === '42703';
const isMissingRelation = (error) => error?.code === '42P01' || error?.code === 'PGRST201' || error?.code === 'PGRST301';
const shouldUseLegacySchema = (error) => isMissingColumn(error) || isMissingRelation(error);

export const getCustomerSummary = async (address) => {
  const client = requireSupabase();
  const wallet = normaliseAddress(address);
  if (!wallet) {
    throw new Error('wallet address required');
  }

  const base = {
    wallet_address: wallet,
    stamp_count: 0,
    pending_rewards: 0,
    reward_eligible: false,
    lifetime_stamps: 0,
    reward_threshold: DEFAULT_REWARD_THRESHOLD,
    last_updated: null,
    email: null,
  };

  try {
  const { data, error } = await client
      .from('stamps')
      .select(
        'customer_wallet, stamp_count, pending_rewards, reward_eligible, last_updated, lifetime_stamps, reward_threshold, customers!inner(email)'
      )
      .eq('customer_wallet', wallet)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
      throw error;
    }

    if (!data) {
      return base;
    }

    return {
      wallet_address: wallet,
      stamp_count: Number(data.stamp_count || 0),
      pending_rewards: Number(data.pending_rewards || 0),
      reward_eligible: Boolean(data.reward_eligible) || Number(data.pending_rewards || 0) > 0,
      lifetime_stamps: Number(data.lifetime_stamps || 0),
      reward_threshold: Number(data.reward_threshold || DEFAULT_REWARD_THRESHOLD),
      last_updated: data.last_updated || null,
      email: data.customers?.email || null,
    };
  } catch (error) {
    if (!shouldUseLegacySchema(error)) {
    console.error('Error fetching customer summary:', error);
    throw error;
  }

    const { data: legacy, error: legacyError } = await client
      .from('customers')
      .select('wallet_address, stamp_count, pending_rewards, total_volume, last_purchase_at, updated_at')
      .eq('wallet_address', wallet)
      .maybeSingle();

    if (legacyError && legacyError.code !== 'PGRST116') {
      console.error('Legacy customer summary error:', legacyError);
      throw legacyError;
    }

    if (!legacy) {
      return base;
    }

    return {
      wallet_address: wallet,
      stamp_count: Number(legacy.stamp_count || 0),
      pending_rewards: Number(legacy.pending_rewards || 0),
      reward_eligible: Number(legacy.pending_rewards || 0) > 0,
      lifetime_stamps: Number(legacy.stamp_count || 0),
      reward_threshold: DEFAULT_REWARD_THRESHOLD,
      last_updated: legacy.updated_at || legacy.last_purchase_at || null,
      email: null,
    };
  }
};

export const listCustomers = async () => {
  const client = requireSupabase();
  try {
  const { data, error } = await client
      .from('stamps')
      .select(
        'customer_wallet, stamp_count, pending_rewards, reward_eligible, last_updated, lifetime_stamps, reward_threshold, customers!inner(email)'
      )
      .order('last_updated', { ascending: false })
      .limit(250);

    if (error) {
      throw error;
    }

    return (
      data?.map((row) => ({
        customer_wallet: row.customer_wallet,
        stamp_count: Number(row.stamp_count || 0),
        pending_rewards: Number(row.pending_rewards || 0),
        reward_eligible: Boolean(row.reward_eligible) || Number(row.pending_rewards || 0) > 0,
        last_updated: row.last_updated,
        lifetime_stamps: Number(row.lifetime_stamps || 0),
        reward_threshold: Number(row.reward_threshold || DEFAULT_REWARD_THRESHOLD),
        email: row.customers?.email || null,
      })) || []
    );
  } catch (error) {
    if (!shouldUseLegacySchema(error)) {
      console.error('Error listing customers:', error);
      throw error;
    }

    const { data, error: legacyError } = await client
    .from('customers')
    .select('wallet_address, stamp_count, pending_rewards, total_volume, last_purchase_at, updated_at, created_at')
    .order('updated_at', { ascending: false })
    .limit(250);

    if (legacyError) {
      console.error('Legacy customer list error:', legacyError);
      throw legacyError;
  }

    return (
      data?.map((row) => ({
        customer_wallet: row.wallet_address,
        stamp_count: Number(row.stamp_count || 0),
        pending_rewards: Number(row.pending_rewards || 0),
        reward_eligible: Number(row.pending_rewards || 0) > 0,
        last_updated: row.updated_at || row.last_purchase_at,
        lifetime_stamps: Number(row.stamp_count || 0),
        reward_threshold: DEFAULT_REWARD_THRESHOLD,
        email: null,
      })) || []
    );
  }
};

export const recordPurchase = async ({
  walletAddress,
  email,
  totalBWT,
  items,
  txHash,
  blockNumber,
  status = 'PAID',
  merchantEmail,
  rewardThreshold = DEFAULT_REWARD_THRESHOLD,
  stampsAwarded = 1,
  pendingRewards,
  stampCount,
  productId,
  productName,
  priceBWT,
  metadata,
}) => {
  const client = requireSupabase();
  const wallet = normaliseAddress(walletAddress);
  if (!wallet) {
    throw new Error('wallet address required');
  }
  if (!txHash) {
    throw new Error('transaction hash required');
  }

  const now = new Date().toISOString();
  const threshold = Number(rewardThreshold) || DEFAULT_REWARD_THRESHOLD;

  const normalisedItems =
    Array.isArray(items) && items.length > 0
      ? items.map((item) => ({
          id: item.id || item.productId || null,
          name: item.name || item.productName || null,
          price: parseNumeric(item.price ?? item.priceBWT ?? 0),
          quantity: Number(item.quantity ?? item.qty ?? 1),
        }))
      : productId
      ? [
          {
            id: productId,
            name: productName || productId,
            price: parseNumeric(priceBWT),
            quantity: Number(stampsAwarded || 1),
          },
        ]
      : [];

  const computedTotal = normalisedItems.reduce(
    (acc, item) => acc + item.price * (item.quantity || 1),
    0
  );
  let totalBwtNumeric = parseNumeric(totalBWT);
  if (totalBwtNumeric <= 0 && computedTotal > 0) {
    totalBwtNumeric = computedTotal;
  }
  if (totalBwtNumeric <= 0) {
    totalBwtNumeric = parseNumeric(priceBWT);
  }

  try {
    const customerPayload = {
      wallet_address: wallet,
      updated_at: now,
    };
    if (email) {
      customerPayload.email = String(email).trim().toLowerCase();
    }

    const { error: customerError } = await client
      .from('customers')
      .upsert(customerPayload, { onConflict: 'wallet_address' });

    if (customerError) {
      throw customerError;
    }

    const { data: existingStamp, error: stampFetchError } = await client
      .from('stamps')
      .select('stamp_count, pending_rewards, lifetime_stamps, reward_threshold, reward_eligible, last_order_id')
      .eq('customer_wallet', wallet)
      .maybeSingle();

    if (stampFetchError && stampFetchError.code !== 'PGRST116') {
      throw stampFetchError;
    }

    const lifetimeStamps =
      Number(existingStamp?.lifetime_stamps || 0) + Number(stampsAwarded || 1);

    let nextStampCount =
      stampCount !== undefined && stampCount !== null
        ? Number(stampCount)
        : Number(existingStamp?.stamp_count || 0) + Number(stampsAwarded || 1);

    let nextPendingRewards =
      pendingRewards !== undefined && pendingRewards !== null
        ? Number(pendingRewards)
        : Number(existingStamp?.pending_rewards || 0);

    if (pendingRewards === undefined && stampCount === undefined) {
      while (nextStampCount >= threshold) {
        nextStampCount -= threshold;
        nextPendingRewards += 1;
      }
    }

    const rewardEligible = nextPendingRewards > 0 || nextStampCount >= threshold;

    const orderPayload = {
      customer_wallet: wallet,
      items: normalisedItems,
      total_bwt: totalBwtNumeric,
      tx_hash: txHash,
      block_number: blockNumber || null,
      status,
      merchant_email: merchantEmail || null,
      metadata: metadata || null,
      created_at: now,
    };

    let orderRecord = null;
    const { data: insertedOrder, error: orderError } = await client
      .from('orders')
      .insert(orderPayload)
      .select()
      .maybeSingle();

    if (orderError && orderError.code !== '23505') {
      throw orderError;
    }
    if (!orderError) {
      orderRecord = insertedOrder;
    }

    const stampPayload = {
      customer_wallet: wallet,
      stamp_count: nextStampCount,
      pending_rewards: nextPendingRewards,
      reward_eligible: rewardEligible,
      last_updated: now,
      lifetime_stamps: lifetimeStamps,
      reward_threshold: threshold,
      last_order_id: orderRecord?.id || existingStamp?.last_order_id || null,
    };

    const { error: stampError } = await client
      .from('stamps')
      .upsert(stampPayload, { onConflict: 'customer_wallet' });

    if (stampError) {
      throw stampError;
    }

    return {
      wallet_address: wallet,
      stamp_count: nextStampCount,
      pending_rewards: nextPendingRewards,
      rewardEligible,
      lifetime_stamps: lifetimeStamps,
      email: customerPayload.email || null,
    };
  } catch (error) {
    if (!shouldUseLegacySchema(error)) {
      console.error('Error recording purchase:', error);
      throw error;
    }

    return recordPurchaseLegacy({
      client,
      wallet,
      totalBwtNumeric,
      productId,
      productName,
      priceBWT,
      txHash,
      blockNumber,
      metadata,
      rewardThreshold: threshold,
      stampsAwarded,
      now,
    });
  }
};

const recordPurchaseLegacy = async ({
  client,
  wallet,
  totalBwtNumeric,
  productId,
  productName,
  priceBWT,
  txHash,
  blockNumber,
  metadata,
  rewardThreshold,
  stampsAwarded,
  now,
}) => {
  const price = totalBwtNumeric > 0 ? totalBwtNumeric : parseNumeric(priceBWT);
  const threshold = Number(rewardThreshold) || DEFAULT_REWARD_THRESHOLD;

  const { data: existing, error: fetchError } = await client
    .from('customers')
    .select('stamp_count, pending_rewards, total_volume, created_at')
    .eq('wallet_address', wallet)
    .maybeSingle();

  if (fetchError && fetchError.code !== 'PGRST116') {
    throw fetchError;
  }

  let currentStamp = existing?.stamp_count ?? 0;
  let pendingRewards = existing?.pending_rewards ?? 0;
  const currentVolume = parseNumeric(existing?.total_volume);

  currentStamp += Number(stampsAwarded || 1);
  let rewardEarned = false;

  while (currentStamp >= threshold) {
    currentStamp -= threshold;
    pendingRewards += 1;
    rewardEarned = true;
  }

  const totalVolume = currentVolume + price;

  const upsertPayload = {
    wallet_address: wallet,
    stamp_count: currentStamp,
    pending_rewards: pendingRewards,
    total_volume: totalVolume,
    last_purchase_at: now,
    updated_at: now,
    created_at: existing?.created_at || now,
  };

  const { error: upsertError } = await client
    .from('customers')
    .upsert(upsertPayload, { onConflict: 'wallet_address' });

  if (upsertError) {
    throw upsertError;
  }

  const { error: insertPurchaseError } = await client.from('purchase_history').insert({
    wallet_address: wallet,
    product_id: productId || null,
    product_name: productName || null,
    price_bwt: price,
    tx_hash: txHash,
    block_number: blockNumber || null,
    outlet_id: null,
    metadata: metadata || null,
    created_at: now,
  });

  if (insertPurchaseError && insertPurchaseError.code !== '23505') {
    throw insertPurchaseError;
  }

  return {
    wallet_address: wallet,
    stamp_count: currentStamp,
    pending_rewards: pendingRewards,
    rewardEligible: rewardEarned || pendingRewards > 0,
    lifetime_stamps: currentStamp,
    email: null,
  };
};

export const recordRewardRedemption = async ({ walletAddress, txHash, blockNumber, rewardAmountBWT }) => {
  const client = requireSupabase();
  const wallet = normaliseAddress(walletAddress);
  if (!wallet) {
    throw new Error('wallet address required');
  }

  try {
  const { data: existing, error } = await client
      .from('stamps')
      .select('pending_rewards')
      .eq('customer_wallet', wallet)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    const pending = Number(existing?.pending_rewards || 0);
    if (pending <= 0) {
      throw new Error('No pending rewards to redeem');
    }

    const now = new Date().toISOString();
    const newPending = pending - 1;

    const { error: updateError } = await client
      .from('stamps')
      .update({
        pending_rewards: newPending,
        reward_eligible: newPending > 0,
        stamp_count: 0,
        last_updated: now,
      })
      .eq('customer_wallet', wallet);

    if (updateError) {
      throw updateError;
    }

    const { error: insertError } = await client.from('reward_history').insert({
      wallet_address: wallet,
      reward_amount_bwt: parseNumeric(rewardAmountBWT),
      tx_hash: txHash || null,
      block_number: blockNumber || null,
      created_at: now,
    });

    if (insertError) {
      throw insertError;
    }

    return {
      wallet_address: wallet,
      pending_rewards: newPending,
      reward_eligible: newPending > 0,
      redeemed_at: now,
    };
  } catch (error) {
    if (!shouldUseLegacySchema(error)) {
      console.error('Reward redemption sync error:', error);
      throw error;
    }

    const { data: existing, error: legacyError } = await client
    .from('customers')
    .select('pending_rewards')
    .eq('wallet_address', wallet)
    .maybeSingle();

    if (legacyError && legacyError.code !== 'PGRST116') {
      throw legacyError;
  }

    const pending = Number(existing?.pending_rewards || 0);
  if (pending <= 0) {
    throw new Error('No pending rewards to redeem');
  }

  const now = new Date().toISOString();
  const { error: updateError } = await client
    .from('customers')
    .update({ pending_rewards: pending - 1, updated_at: now })
    .eq('wallet_address', wallet);

  if (updateError) {
    throw updateError;
  }

  const { error: insertError } = await client.from('reward_history').insert({
    wallet_address: wallet,
    reward_amount_bwt: parseNumeric(rewardAmountBWT),
    tx_hash: txHash || null,
    block_number: blockNumber || null,
    created_at: now,
  });

  if (insertError) {
    throw insertError;
  }

  return {
    wallet_address: wallet,
    pending_rewards: pending - 1,
      reward_eligible: pending - 1 > 0,
    redeemed_at: now,
  };
  }
};

export const getPurchaseHistory = async (walletAddress, limit = 50) => {
  const client = requireSupabase();
  const wallet = normaliseAddress(walletAddress);
  
  try {
    // Try to get orders with customer email join
    const query = client
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (wallet) {
      query.eq('customer_wallet', wallet);
    }

    const { data: orders, error: orderError } = await query;
    
    if (orderError) {
      throw orderError;
    }

    if (!orders || orders.length === 0) {
      return [];
    }

    // Get unique customer wallets
    const customerWallets = [...new Set(orders.map((o) => o.customer_wallet).filter(Boolean))];
    
    // Fetch customer emails and stamp data
    let customerEmails = {};
    let customerStamps = {};
    if (customerWallets.length > 0) {
      try {
        const [customersData, stampsData] = await Promise.all([
          client
            .from('customers')
            .select('wallet_address, email')
            .in('wallet_address', customerWallets),
          client
            .from('stamps')
            .select('customer_wallet, stamp_count, pending_rewards')
            .in('customer_wallet', customerWallets)
        ]);
        
        if (customersData) {
          customerEmails = customersData.reduce((acc, c) => {
            if (c.wallet_address && c.email) {
              acc[c.wallet_address.toLowerCase()] = c.email;
            }
            return acc;
          }, {});
        }

        if (stampsData) {
          customerStamps = stampsData.reduce((acc, s) => {
            if (s.customer_wallet) {
              acc[s.customer_wallet.toLowerCase()] = {
                stampCount: Number(s.stamp_count || 0),
                pendingRewards: Number(s.pending_rewards || 0),
              };
            }
            return acc;
          }, {});
        }
      } catch (error) {
        console.warn('Failed to fetch customer data:', error);
        // Continue without emails/stamps
      }
    }

    // Combine orders with email and stamp data
    const enriched = (orders || []).map((order) => {
      const wallet = order.customer_wallet?.toLowerCase();
      const email = customerEmails[wallet] || 
                   order.metadata?.email || 
                   null;
      const stampData = customerStamps[wallet];
      const metadata = order.metadata || {};
      
      // Enhance metadata with current stamp data if available
      if (stampData) {
        metadata.stampCount = stampData.stampCount;
        metadata.pendingRewards = stampData.pendingRewards;
        // Try to preserve stampsAwarded from original metadata, or default to 1
        if (metadata.stampsAwarded === undefined) {
          metadata.stampsAwarded = 1;
        }
      }
      
      return {
        ...order,
        email,
        metadata: {
          ...metadata,
          ...(stampData ? {
            stampCount: stampData.stampCount,
            pendingRewards: stampData.pendingRewards,
          } : {}),
        },
      };
    });

    return enriched;
  } catch (error) {
    if (!shouldUseLegacySchema(error)) {
      console.error('Error fetching order history:', error);
      throw error;
    }

    // Fallback to legacy purchase_history table
    const legacyQuery = client
      .from('purchase_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (wallet) {
      legacyQuery.eq('wallet_address', wallet);
    }

    const { data, error: legacyError } = await legacyQuery;
    if (legacyError) {
      console.error('Legacy purchase history error:', legacyError);
      throw legacyError;
    }

    return data || [];
  }
};

export const getRewardHistory = async (walletAddress, limit = 25) => {
  const client = requireSupabase();
  const wallet = normaliseAddress(walletAddress);
  const query = client
    .from('reward_history')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (wallet) {
    query.eq('wallet_address', wallet);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching reward history:', error);
    throw error;
  }

  return data || [];
};

export const getOutlets = async () => {
  const client = requireSupabase();
  const { data, error } = await client
    .from('outlets')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error getting outlets:', error);
    throw error;
  }

  return data || [];
};

export const getOutlet = async (id) => {
  const client = requireSupabase();
  const { data, error } = await client
    .from('outlets')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    console.error('Error getting outlet:', error);
    throw error;
  }

  return data || null;
};

export const createOutlet = async ({
  name,
  address,
  ownerAddress,
  merchantAddress,
  location,
  website,
  challengeUrl,
  signerPublicKey,
}) => {
  const client = requireSupabase();
  const { data, error } = await client
    .from('outlets')
    .insert({
      name,
      address,
      owner_address: ownerAddress,
      merchant_address: merchantAddress,
      location,
      website,
      challenge_url: challengeUrl,
      signer_public_key: signerPublicKey,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating outlet:', error);
    throw error;
  }

  return { lastInsertRowid: data?.id || null };
};

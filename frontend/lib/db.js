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

export const getCustomerSummary = async (address) => {
  const client = requireSupabase();
  const wallet = normaliseAddress(address);
  if (!wallet) {
    throw new Error('wallet address required');
  }

  const { data, error } = await client
    .from('customers')
    .select('wallet_address, stamp_count, pending_rewards, total_volume, last_purchase_at, created_at, updated_at')
    .eq('wallet_address', wallet)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching customer summary:', error);
    throw error;
  }

  return (
    data || {
      wallet_address: wallet,
      stamp_count: 0,
      pending_rewards: 0,
      total_volume: 0,
      last_purchase_at: null,
    }
  );
};

export const listCustomers = async () => {
  const client = requireSupabase();
  const { data, error } = await client
    .from('customers')
    .select('wallet_address, stamp_count, pending_rewards, total_volume, last_purchase_at, updated_at, created_at')
    .order('updated_at', { ascending: false })
    .limit(250);

  if (error) {
    console.error('Error listing customers:', error);
    throw error;
  }

  return data || [];
};

export const recordPurchase = async ({
  walletAddress,
  productId,
  productName,
  priceBWT,
  txHash,
  blockNumber,
  outletId,
  metadata,
  rewardThreshold = DEFAULT_REWARD_THRESHOLD,
  stampsAwarded = 1,
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
  const price = parseNumeric(priceBWT);
  const threshold = Number(rewardThreshold) || DEFAULT_REWARD_THRESHOLD;

  const { data: existing, error: fetchError } = await client
    .from('customers')
    .select('stamp_count, pending_rewards, total_volume')
    .eq('wallet_address', wallet)
    .maybeSingle();

  if (fetchError && fetchError.code !== 'PGRST116') {
    console.error('Error loading customer counters:', fetchError);
    throw fetchError;
  }

  let currentStamp = existing?.stamp_count ?? 0;
  let pendingRewards = existing?.pending_rewards ?? 0;
  const currentVolume = parseNumeric(existing?.total_volume);

  currentStamp += Number(stampsAwarded);
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
    console.error('Error updating customer counters:', upsertError);
    throw upsertError;
  }

  const { error: insertPurchaseError } = await client.from('purchase_history').insert({
    wallet_address: wallet,
    product_id: productId,
    product_name: productName,
    price_bwt: price,
    tx_hash: txHash,
    block_number: blockNumber,
    outlet_id: outletId,
    metadata: metadata || null,
    created_at: now,
  });

  if (insertPurchaseError && insertPurchaseError.code !== '23505') {
    console.error('Error recording purchase:', insertPurchaseError);
    throw insertPurchaseError;
  }

  return {
    wallet_address: wallet,
    stamp_count: currentStamp,
    pending_rewards: pendingRewards,
    total_volume: totalVolume,
    rewardEarned,
    last_purchase_at: now,
  };
};

export const recordRewardRedemption = async ({ walletAddress, txHash, blockNumber, rewardAmountBWT }) => {
  const client = requireSupabase();
  const wallet = normaliseAddress(walletAddress);
  if (!wallet) {
    throw new Error('wallet address required');
  }

  const { data: existing, error } = await client
    .from('customers')
    .select('pending_rewards')
    .eq('wallet_address', wallet)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    console.error('Error loading customer rewards:', error);
    throw error;
  }

  const pending = existing?.pending_rewards ?? 0;
  if (pending <= 0) {
    throw new Error('No pending rewards to redeem');
  }

  const now = new Date().toISOString();
  const { error: updateError } = await client
    .from('customers')
    .update({ pending_rewards: pending - 1, updated_at: now })
    .eq('wallet_address', wallet);

  if (updateError) {
    console.error('Error updating reward count:', updateError);
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
    console.error('Error recording reward redemption:', insertError);
    throw insertError;
  }

  return {
    wallet_address: wallet,
    pending_rewards: pending - 1,
    redeemed_at: now,
  };
};

export const getPurchaseHistory = async (walletAddress, limit = 50) => {
  const client = requireSupabase();
  const wallet = normaliseAddress(walletAddress);
  const query = client
    .from('purchase_history')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (wallet) {
    query.eq('wallet_address', wallet);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching purchase history:', error);
    throw error;
  }

  return data || [];
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

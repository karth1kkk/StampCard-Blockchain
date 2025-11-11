import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

let supabase = null;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
} else {
  console.warn('Supabase credentials not found. Database operations will be limited.');
}

// Customer operations
export const getCustomer = async (address) => {
  if (!supabase) {
    console.warn('Supabase not initialized');
    return null;
  }
  
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('address', address.toLowerCase())
    .single();
  
  if (error && error.code !== 'PGRST116') { // PGRST116 = not found
    console.error('Error getting customer:', error);
    return null;
  }
  
  return data;
};

export const createCustomer = async (address, name, email, phone) => {
  if (!supabase) {
    console.warn('Supabase not initialized');
    return { changes: 0 };
  }
  
  const { data, error } = await supabase
    .from('customers')
    .upsert({
      address: address.toLowerCase(),
      name,
      email,
      phone,
      created_at: new Date().toISOString()
    }, {
      onConflict: 'address'
    });
  
  if (error) {
    console.error('Error creating customer:', error);
    return { changes: 0 };
  }
  
  return { changes: 1 };
};

export const updateCustomer = async (address, name, email, phone) => {
  if (!supabase) {
    console.warn('Supabase not initialized');
    return { changes: 0 };
  }
  
  const { data, error } = await supabase
    .from('customers')
    .update({
      name,
      email,
      phone
    })
    .eq('address', address.toLowerCase());
  
  if (error) {
    console.error('Error updating customer:', error);
    return { changes: 0 };
  }
  
  return { changes: data?.length || 0 };
};

// Outlet operations
export const getOutlets = async () => {
  if (!supabase) {
    console.warn('Supabase not initialized');
    return [];
  }
  
  const { data, error } = await supabase
    .from('outlets')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error getting outlets:', error);
    return [];
  }
  
  return data || [];
};

export const getOutlet = async (id) => {
  if (!supabase) {
    console.warn('Supabase not initialized');
    return null;
  }
  
  const { data, error } = await supabase
    .from('outlets')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    console.error('Error getting outlet:', error);
    return null;
  }
  
  return data;
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
  if (!supabase) {
    console.warn('Supabase not initialized');
    return { lastInsertRowid: null };
  }
  
  const { data, error } = await supabase
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
      created_at: new Date().toISOString()
    })
    .select()
    .single();
  
  if (error) {
    console.error('Error creating outlet:', error);
    return { lastInsertRowid: null };
  }
  
  return { lastInsertRowid: data?.id || null };
};

// Transaction operations
export const saveTransaction = async (customerAddress, transactionHash, transactionType, blockNumber) => {
  if (!supabase) {
    console.warn('Supabase not initialized');
    return { changes: 0 };
  }
  
  const { data, error } = await supabase
    .from('transactions')
    .upsert({
      customer_address: customerAddress.toLowerCase(),
      transaction_hash: transactionHash,
      transaction_type: transactionType,
      block_number: blockNumber,
      created_at: new Date().toISOString()
    }, {
      onConflict: 'transaction_hash'
    });
  
  if (error) {
    console.error('Error saving transaction:', error);
    return { changes: 0 };
  }
  
  return { changes: 1 };
};

export const getCustomerTransactions = async (customerAddress) => {
  if (!supabase) {
    console.warn('Supabase not initialized');
    return [];
  }
  
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('customer_address', customerAddress.toLowerCase())
    .order('created_at', { ascending: false })
    .limit(50);
  
  if (error) {
    console.error('Error getting customer transactions:', error);
    return [];
  }
  
  return data || [];
};

export const getAllTransactions = async () => {
  if (!supabase) {
    console.warn('Supabase not initialized');
    return [];
  }
  
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  
  if (error) {
    console.error('Error getting all transactions:', error);
    return [];
  }
  
  return data || [];
};

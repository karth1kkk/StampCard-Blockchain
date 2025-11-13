-- Supabase Database Schema for BrewToken Coffee Loyalty System
-- Run this SQL in your Supabase SQL Editor

-- Drop existing tables if you are migrating from the previous implementation (optional)
-- DROP TABLE IF EXISTS reward_history;
-- DROP TABLE IF EXISTS purchase_history;
-- DROP TABLE IF EXISTS customers;

CREATE TABLE IF NOT EXISTS customers (
  wallet_address TEXT PRIMARY KEY,
  stamp_count INTEGER NOT NULL DEFAULT 0,
  pending_rewards INTEGER NOT NULL DEFAULT 0,
  total_volume NUMERIC(24, 6) NOT NULL DEFAULT 0,
  last_purchase_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_history (
  id BIGSERIAL PRIMARY KEY,
  wallet_address TEXT NOT NULL REFERENCES customers(wallet_address) ON DELETE CASCADE,
  product_id TEXT,
  product_name TEXT,
  price_bwt NUMERIC(24, 6) NOT NULL,
  tx_hash TEXT UNIQUE NOT NULL,
  block_number BIGINT,
  outlet_id INTEGER,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reward_history (
  id BIGSERIAL PRIMARY KEY,
  wallet_address TEXT NOT NULL REFERENCES customers(wallet_address) ON DELETE CASCADE,
  reward_amount_bwt NUMERIC(24, 6),
  reward_type TEXT DEFAULT 'FREE_DRINK',
  tx_hash TEXT,
  block_number BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS outlets (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  owner_address TEXT,
  merchant_address TEXT,
  location TEXT,
  website TEXT,
  challenge_url TEXT,
  signer_public_key TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customers_wallet ON customers(wallet_address);
CREATE INDEX IF NOT EXISTS idx_customers_updated_at ON customers(updated_at);
CREATE INDEX IF NOT EXISTS idx_purchase_wallet ON purchase_history(wallet_address);
CREATE INDEX IF NOT EXISTS idx_purchase_tx_hash ON purchase_history(tx_hash);
CREATE INDEX IF NOT EXISTS idx_reward_wallet ON reward_history(wallet_address);

-- Enable Row Level Security (optional, configure policies to suit your needs)
-- ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE purchase_history ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE reward_history ENABLE ROW LEVEL SECURITY;


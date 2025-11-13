-- Supabase Database Schema for BrewToken POS Loyalty
-- Run this SQL in your Supabase SQL Editor

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS merchants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
  wallet_address TEXT PRIMARY KEY,
  email TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_wallet TEXT REFERENCES customers(wallet_address) ON DELETE SET NULL,
  items JSONB NOT NULL DEFAULT '[]'::JSONB,
  total_bwt NUMERIC(24, 6) NOT NULL,
  tx_hash TEXT UNIQUE,
  block_number BIGINT,
  status TEXT NOT NULL DEFAULT 'PAID',
  merchant_email TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stamps (
  customer_wallet TEXT PRIMARY KEY REFERENCES customers(wallet_address) ON DELETE CASCADE,
  stamp_count INTEGER NOT NULL DEFAULT 0,
  pending_rewards INTEGER NOT NULL DEFAULT 0,
  reward_eligible BOOLEAN NOT NULL DEFAULT FALSE,
  lifetime_stamps INTEGER NOT NULL DEFAULT 0,
  reward_threshold INTEGER NOT NULL DEFAULT 8,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_order_id UUID REFERENCES orders(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS reward_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address TEXT NOT NULL REFERENCES customers(wallet_address) ON DELETE CASCADE,
  reward_amount_bwt NUMERIC(24, 6),
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

CREATE INDEX IF NOT EXISTS idx_orders_wallet ON orders(customer_wallet);
CREATE INDEX IF NOT EXISTS idx_orders_tx_hash ON orders(tx_hash);
CREATE INDEX IF NOT EXISTS idx_stamps_wallet ON stamps(customer_wallet);
CREATE INDEX IF NOT EXISTS idx_stamps_updated ON stamps(last_updated);
CREATE INDEX IF NOT EXISTS idx_reward_wallet ON reward_history(wallet_address);

-- Enable Row Level Security (optional, configure policies to suit your needs)
-- ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE stamps ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE reward_history ENABLE ROW LEVEL SECURITY;


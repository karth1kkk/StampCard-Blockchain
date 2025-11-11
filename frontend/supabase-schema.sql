-- Supabase Database Schema for StampCard Blockchain DApp
-- Run this SQL in your Supabase SQL Editor

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
  address TEXT PRIMARY KEY,
  name TEXT,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Outlets table
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

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  customer_address TEXT,
  transaction_hash TEXT UNIQUE,
  transaction_type TEXT,
  block_number INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_address) REFERENCES customers(address)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_transactions_customer ON transactions(customer_address);
CREATE INDEX IF NOT EXISTS idx_transactions_hash ON transactions(transaction_hash);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_customers_address ON customers(address);
CREATE INDEX IF NOT EXISTS idx_outlets_owner ON outlets(owner_address);
CREATE INDEX IF NOT EXISTS idx_outlets_merchant ON outlets(merchant_address);

-- Enable Row Level Security (RLS) - Optional, adjust based on your needs
-- ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE outlets ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Example policies (adjust based on your security requirements)
-- CREATE POLICY "Allow public read access" ON customers FOR SELECT USING (true);
-- CREATE POLICY "Allow public insert" ON customers FOR INSERT WITH CHECK (true);
-- CREATE POLICY "Allow public update" ON customers FOR UPDATE USING (true);


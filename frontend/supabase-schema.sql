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

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  image TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_wallet ON orders(customer_wallet);
CREATE INDEX IF NOT EXISTS idx_orders_tx_hash ON orders(tx_hash);
CREATE INDEX IF NOT EXISTS idx_stamps_wallet ON stamps(customer_wallet);
CREATE INDEX IF NOT EXISTS idx_stamps_updated ON stamps(last_updated);
CREATE INDEX IF NOT EXISTS idx_reward_wallet ON reward_history(wallet_address);
CREATE INDEX IF NOT EXISTS idx_products_id ON products(id);

-- Insert default coffee menu products
INSERT INTO products (id, name, description, price, image) VALUES
  ('espresso-classic', 'Classic Espresso', 'Single-origin espresso shot with a rich crema.', 3.00, 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=400&h=400&fit=crop&q=80'),
  ('double-espresso', 'Double Espresso', 'Two bold shots pulled back-to-back for extra punch.', 4.50, 'https://images.unsplash.com/photo-1593231362449-aed8e71f1c2b?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Nnx8ZG91YmxlJTIwZXNwcmVzc298ZW58MHx8MHx8fDA%3D'),
  ('americano', 'Americano', 'Espresso blended with hot water for a smooth finish.', 3.50, 'https://images.unsplash.com/photo-1551030173-122aabc4489c?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8YW1lcmljYW5vfGVufDB8fDB8fHww'),
  ('flat-white', 'Flat White', 'Silky steamed milk layered over a balanced espresso.', 4.00, 'https://images.unsplash.com/photo-1742654230423-381647224273?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MjB8fGZsYXQlMjB3aGl0ZXxlbnwwfHwwfHx8MA%3D%3D'),
  ('cappuccino', 'Cappuccino', 'Equal parts espresso, steamed milk and airy foam.', 4.20, 'https://images.unsplash.com/photo-1525797559391-d6c6fd668582?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTB8fGNhcHB1Y2lub3xlbnwwfHwwfHx8MA%3D%3D'),
  ('latte-vanilla', 'Vanilla Latte', 'Espresso with steamed milk and Madagascar vanilla syrup.', 4.80, 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400&h=400&fit=crop&q=80'),
  ('dark-mocha', 'Dark Mocha', 'Chocolate-infused espresso topped with whipped cream.', 5.20, 'https://images.unsplash.com/photo-1736788264333-0a3d12f52368?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Nnx8ZGFyayUyMG1vY2hhfGVufDB8fDB8fHww'),
  ('matcha-latte', 'Matcha Latte', 'Stone-ground matcha whisked with sweetened steamed milk.', 5.00, 'https://images.unsplash.com/photo-1515823064-d6e0c04616a7?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8bWF0Y2hhJTIwbGF0dGV8ZW58MHx8MHx8fDA%3D'),
  ('iced-caramel', 'Iced Caramel Coffee', 'Cold brew over ice with caramel drizzle and cream.', 5.50, 'https://images.unsplash.com/photo-1579888071069-c107a6f79d82?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8aWNlZCUyMGNhcmFtZWx8ZW58MHx8MHx8fDA%3D'),
  ('nitro-cold-brew', 'Nitro Cold Brew', 'Nitrogen-infused cold brew with a silky, sweet texture.', 5.80, 'https://images.unsplash.com/photo-1644764399224-f7d18b1e8d1c?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8bml0cm8lMjBjb2xkJTIwYnJld3xlbnwwfHwwfHx8MA%3D%3D')
ON CONFLICT (id) DO NOTHING;

-- Enable Row Level Security (optional, configure policies to suit your needs)
-- ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE stamps ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE reward_history ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE products ENABLE ROW LEVEL SECURITY;


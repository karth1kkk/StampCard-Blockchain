-- Clear all data from Supabase database while keeping table structure
-- Run this SQL in your Supabase SQL Editor
-- 
-- WARNING: This will delete ALL data from all tables. Use with caution!

-- Option 1: Using TRUNCATE CASCADE (Recommended - faster and handles foreign keys automatically)
-- This will delete all data and reset auto-increment sequences

TRUNCATE TABLE 
  reward_history,
  stamps,
  orders,
  customers,
  products
CASCADE;

-- Option 2: Using DELETE (Alternative - more control, respects foreign key constraints)
-- Uncomment the lines below if you prefer DELETE over TRUNCATE

-- DELETE FROM reward_history;
-- DELETE FROM stamps;
-- DELETE FROM orders;
-- DELETE FROM customers;
-- DELETE FROM products;

-- Note: TRUNCATE automatically resets sequences. No need to manually reset.


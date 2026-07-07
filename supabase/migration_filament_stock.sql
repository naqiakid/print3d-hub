-- ============================================================
-- Migration: Filament stock quantity tracking
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Optional per-roll quantity tracking. NULL grams_remaining means the owner
-- hasn't opted into quantity tracking for that roll — it stays a simple
-- in_stock boolean like before. Once set, grams_remaining is auto-decremented
-- when a job using that filament is marked "done".
ALTER TABLE filaments ADD COLUMN IF NOT EXISTS grams_total NUMERIC(10, 1);
ALTER TABLE filaments ADD COLUMN IF NOT EXISTS grams_remaining NUMERIC(10, 1);
ALTER TABLE filaments ADD COLUMN IF NOT EXISTS low_stock_threshold_g NUMERIC(10, 1) NOT NULL DEFAULT 100;

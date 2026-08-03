-- ============================================================
-- Print3DHub — Migration for Affiliate Program
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Create affiliates table
CREATE TABLE IF NOT EXISTS affiliates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        UUID REFERENCES profiles(id) ON DELETE CASCADE, -- Nullable for global/system codes
  code            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL, -- Promoter / Affiliate name
  commission_pct  NUMERIC(5, 2) NOT NULL DEFAULT 5.00,
  discount_pct    NUMERIC(5, 2) NOT NULL DEFAULT 5.00,
  is_active       BOOLEAN DEFAULT TRUE,
  clicks_count    INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Modify requests table to track referrals
ALTER TABLE requests ADD COLUMN IF NOT EXISTS affiliate_code TEXT REFERENCES affiliates(code) ON DELETE SET NULL;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS affiliate_commission_amount NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS affiliate_discount_amount NUMERIC(10, 2) DEFAULT 0.00;

-- Enable Row Level Security
ALTER TABLE affiliates ENABLE ROW LEVEL SECURITY;

-- Policies for affiliates table
CREATE POLICY "affiliates_public_read" ON affiliates FOR SELECT USING (TRUE);
CREATE POLICY "affiliates_owner_all" ON affiliates FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- ============================================================
-- Migration: Filaments table
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Each owner manages their own filament inventory separately
-- from the printer device setup.

CREATE TABLE filaments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  material    TEXT NOT NULL,
  brand       TEXT NOT NULL DEFAULT '',
  color       TEXT NOT NULL DEFAULT '',
  color_hex   TEXT NOT NULL DEFAULT '#888888',
  cost_per_kg NUMERIC(10, 2) NOT NULL DEFAULT 0,
  in_stock    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE filaments ENABLE ROW LEVEL SECURITY;

-- Anyone can read filaments (needed for customer request form)
CREATE POLICY "filaments_public_read"
  ON filaments FOR SELECT USING (TRUE);

-- Only the owner can manage their own filaments
CREATE POLICY "filaments_owner_all"
  ON filaments FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

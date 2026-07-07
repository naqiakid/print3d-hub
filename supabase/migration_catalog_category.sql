-- ============================================================
-- Migration: Catalog item categories
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Free-text category tag for grouping/filtering catalog items
-- (e.g. "Home Decor", "Keychains", "Figurines"). NULL = uncategorised.
ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS category TEXT;

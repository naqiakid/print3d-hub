-- Per-material pricing for catalog items that allow material choice.
-- e.g. { "pla": 15.00, "petg": 18.00 }
ALTER TABLE catalog_items
  ADD COLUMN IF NOT EXISTS material_prices jsonb NOT NULL DEFAULT '{}';

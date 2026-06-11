-- Add pickup address and delivery options to printers
ALTER TABLE printers
  ADD COLUMN IF NOT EXISTS pickup_address    TEXT,
  ADD COLUMN IF NOT EXISTS delivery_available BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS delivery_rate_per_km NUMERIC(10,2) DEFAULT 1.00;

-- Add fulfillment type and delivery address to requests
ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS fulfillment      TEXT NOT NULL DEFAULT 'pickup'
    CHECK (fulfillment IN ('pickup', 'delivery')),
  ADD COLUMN IF NOT EXISTS delivery_address TEXT;

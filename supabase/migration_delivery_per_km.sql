-- Switch from flat delivery fee to per-km rate (RM 1.00/km default).
-- Safe to run whether or not migration_delivery.sql has already been applied.
DO $$
BEGIN
  -- Rename delivery_fee_rm → delivery_rate_per_km if old column still exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printers' AND column_name = 'delivery_fee_rm'
  ) THEN
    ALTER TABLE printers RENAME COLUMN delivery_fee_rm TO delivery_rate_per_km;
  END IF;

  -- Add column if it doesn't exist at all yet
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printers' AND column_name = 'delivery_rate_per_km'
  ) THEN
    ALTER TABLE printers ADD COLUMN delivery_rate_per_km NUMERIC(10,2);
  END IF;
END $$;

-- Default all existing rows to RM 1.00/km
UPDATE printers SET delivery_rate_per_km = 1.00 WHERE delivery_rate_per_km IS NULL;

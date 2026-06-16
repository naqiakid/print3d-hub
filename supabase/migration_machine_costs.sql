-- Add machine depreciation rate and waste/maintenance overhead to printer cost model.
-- machine_rate_per_hour: owner sets RM/hr covering printer depreciation + replacement parts
-- waste_percent: % overhead for consumables, failed prints, maintenance (default 8%)
ALTER TABLE printers
  ADD COLUMN IF NOT EXISTS machine_rate_per_hour decimal(10,2) NOT NULL DEFAULT 1.5,
  ADD COLUMN IF NOT EXISTS waste_percent         integer       NOT NULL DEFAULT 8;

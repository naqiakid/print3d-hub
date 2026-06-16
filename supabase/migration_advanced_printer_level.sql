-- Move advanced_available to the printer level (was per print_profile)
ALTER TABLE printers ADD COLUMN IF NOT EXISTS advanced_available boolean NOT NULL DEFAULT false;

-- Store customer's chosen advanced settings on the request
ALTER TABLE requests ADD COLUMN IF NOT EXISTS custom_infill int;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS custom_wall_count int;

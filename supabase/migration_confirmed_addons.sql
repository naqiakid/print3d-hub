-- Add confirmed_addons column to store which requested features the owner confirmed
-- when sending a quote. Separate from selected_addons (what the customer requested).
ALTER TABLE requests ADD COLUMN IF NOT EXISTS confirmed_addons text[] DEFAULT '{}';

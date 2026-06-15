-- Store features the customer explicitly doesn't want.
-- Absence = "owner decides"; selected_addons = "yes please"; declined_addons = "no thanks".
ALTER TABLE requests ADD COLUMN IF NOT EXISTS declined_addons text[] DEFAULT '{}';

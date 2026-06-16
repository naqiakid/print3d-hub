-- Store delivery cost separately from print cost so the customer can see the breakdown.
-- NULL = no delivery (pickup order or owner didn't break it out).
ALTER TABLE requests ADD COLUMN IF NOT EXISTS delivery_cost decimal(10,2);

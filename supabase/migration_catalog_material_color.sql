-- Add material and color to catalog items so owner can specify what each product is printed in.
-- When allow_color_choice is true, color/color_hex are ignored (customer picks from owner's stock).

ALTER TABLE catalog_items
  ADD COLUMN IF NOT EXISTS material text,
  ADD COLUMN IF NOT EXISTS color    text,
  ADD COLUMN IF NOT EXISTS color_hex text;

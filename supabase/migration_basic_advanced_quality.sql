-- Add Basic / Advanced quality tier columns to print_profiles
ALTER TABLE print_profiles
  ADD COLUMN IF NOT EXISTS infill_basic        int  NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS wall_count_basic    int  NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS advanced_available  bool NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS infill_advanced     int  NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS wall_count_advanced int  NOT NULL DEFAULT 5;

-- Seed basic infill from old draft value where it was customised
UPDATE print_profiles SET infill_basic    = infill_draft   WHERE infill_draft   IS NOT NULL;
UPDATE print_profiles SET infill_advanced = infill_premium WHERE infill_premium IS NOT NULL;

-- Migrate existing request quality values to the new two-tier system
UPDATE requests SET quality = 'basic'
  WHERE quality IN ('functional', 'presentable', 'draft', 'standard');

UPDATE requests SET quality = 'advanced'
  WHERE quality IN ('display', 'premium');

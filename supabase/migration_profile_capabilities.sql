-- Add missing capability columns to print_profiles
ALTER TABLE print_profiles
  ADD COLUMN IF NOT EXISTS color_change_available  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pause_insert_available  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS fuzzy_skin_available    BOOLEAN NOT NULL DEFAULT FALSE;

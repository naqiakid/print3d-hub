-- Add text-on-surface capability to print_profiles
ALTER TABLE print_profiles
  ADD COLUMN IF NOT EXISTS text_on_surface_available BOOLEAN NOT NULL DEFAULT FALSE;

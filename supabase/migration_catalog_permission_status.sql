-- Migration: Add permission_status to catalog_items
ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS permission_status TEXT DEFAULT 'not_required';

-- Add check constraint for allowed values
ALTER TABLE catalog_items DROP CONSTRAINT IF EXISTS check_permission_status;
ALTER TABLE catalog_items ADD CONSTRAINT check_permission_status CHECK (permission_status IN ('not_required', 'pending_permission', 'approved', 'denied'));

-- ============================================================
-- Fix catalog_items table schema to match app code
-- ============================================================

ALTER TABLE public.catalog_items 
  ADD COLUMN IF NOT EXISTS name                  TEXT,
  ADD COLUMN IF NOT EXISTS photo_url             TEXT,
  ADD COLUMN IF NOT EXISTS photo_urls            TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS video_url             TEXT,
  ADD COLUMN IF NOT EXISTS stl_urls              TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS allow_custom_text     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS text_prompt           TEXT NOT NULL DEFAULT 'Text to add',
  ADD COLUMN IF NOT EXISTS allow_color_choice    BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_resize          BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS resize_min_pct        INTEGER NOT NULL DEFAULT 80,
  ADD COLUMN IF NOT EXISTS resize_max_pct        INTEGER NOT NULL DEFAULT 150,
  ADD COLUMN IF NOT EXISTS allow_material_choice BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS available_materials   TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS material_prices       JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS material              TEXT,
  ADD COLUMN IF NOT EXISTS color                 TEXT,
  ADD COLUMN IF NOT EXISTS color_hex             TEXT,
  ADD COLUMN IF NOT EXISTS base_price            NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS sort_order            INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS permission_status     TEXT NOT NULL DEFAULT 'not_required';

-- If title exists in fresh_setup and name is null, populate name from title
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'catalog_items' AND column_name = 'title') THEN
    UPDATE public.catalog_items SET name = title WHERE name IS NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'catalog_items' AND column_name = 'price') THEN
    UPDATE public.catalog_items SET base_price = price WHERE base_price IS NULL;
  END IF;
END $$;

-- Make name NOT NULL with default fallback
UPDATE public.catalog_items SET name = 'Untitled Product' WHERE name IS NULL;
ALTER TABLE public.catalog_items ALTER COLUMN name SET NOT NULL;

-- Make sure permission_status has the check constraint
ALTER TABLE public.catalog_items DROP CONSTRAINT IF EXISTS check_permission_status;
ALTER TABLE public.catalog_items ADD CONSTRAINT check_permission_status CHECK (permission_status IN ('not_required', 'pending_permission', 'approved', 'denied'));

-- Ensure RLS policies are correct for catalog_items
DROP POLICY IF EXISTS "catalog_public_read" ON public.catalog_items;
DROP POLICY IF EXISTS "catalog_items_public_read" ON public.catalog_items;
CREATE POLICY "catalog_items_public_read" ON public.catalog_items FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "catalog_owner_all" ON public.catalog_items;
DROP POLICY IF EXISTS "catalog_items_owner_all" ON public.catalog_items;
CREATE POLICY "catalog_items_owner_all" ON public.catalog_items FOR ALL 
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Reload schema cache for PostgREST
NOTIFY pgrst, 'reload schema';

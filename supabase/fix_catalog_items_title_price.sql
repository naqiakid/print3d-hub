-- Drop NOT NULL constraints from unused legacy fresh_setup columns
ALTER TABLE public.catalog_items ALTER COLUMN title DROP NOT NULL;
ALTER TABLE public.catalog_items ALTER COLUMN price DROP NOT NULL;

-- Keep title and price synced with name and base_price via trigger
CREATE OR REPLACE FUNCTION public.sync_catalog_items_compat()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.title IS NULL AND NEW.name IS NOT NULL THEN
    NEW.title := NEW.name;
  END IF;
  IF NEW.name IS NULL AND NEW.title IS NOT NULL THEN
    NEW.name := NEW.title;
  END IF;
  IF NEW.price IS NULL AND NEW.base_price IS NOT NULL THEN
    NEW.price := NEW.base_price;
  END IF;
  IF NEW.base_price IS NULL AND NEW.price IS NOT NULL THEN
    NEW.base_price := NEW.price;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_catalog_items_compat ON public.catalog_items;
CREATE TRIGGER trg_sync_catalog_items_compat
  BEFORE INSERT OR UPDATE ON public.catalog_items
  FOR EACH ROW EXECUTE FUNCTION public.sync_catalog_items_compat();

-- Reload schema cache
NOTIFY pgrst, 'reload schema';

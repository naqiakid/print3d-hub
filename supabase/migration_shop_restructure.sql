-- ============================================================
-- Migration: shop (owner) is the public unit, printers become equipment
-- Run this in the Supabase SQL Editor
--
-- Moves the storefront (public listing) fields from `printers` onto
-- `profiles` (1:1 with owner) so a customer sees ONE shop per owner,
-- not one listing per physical machine. `printers` becomes pure
-- equipment (model/specs), shared across the shop like filament stock
-- already is. `requests`, `catalog_items`, `reviews` move from being
-- keyed by `printer_id` to `owner_id`.
--
-- One-time backfill note: the only owner with >1 printer today is
-- seeded explicitly below from "Akid's Printer" (identity/text fields)
-- with materials/price range computed as an aggregate across all of
-- that owner's printers. New owners only ever start with one printer,
-- so this ambiguity won't recur — a future owner's second+ printer is
-- just equipment added after their shop already exists.
-- ============================================================


-- ── 1. Add storefront columns to profiles ──────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS description          TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS print_types           TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS materials             TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS max_size              TEXT NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS price_min             NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_max             NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS turnaround            TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sample_photos         TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS lat                   FLOAT,
  ADD COLUMN IF NOT EXISTS lng                   FLOAT,
  ADD COLUMN IF NOT EXISTS available             BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS rating                NUMERIC(3, 1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_count          INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pickup_address        TEXT,
  ADD COLUMN IF NOT EXISTS delivery_available    BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS delivery_rate_per_km  NUMERIC(10, 2) DEFAULT 1.00,
  ADD COLUMN IF NOT EXISTS electricity_rate      NUMERIC(10, 4) DEFAULT 0.57,
  ADD COLUMN IF NOT EXISTS markup_percent        NUMERIC(5, 2) DEFAULT 30,
  ADD COLUMN IF NOT EXISTS waste_percent         NUMERIC(5, 2) DEFAULT 8,
  ADD COLUMN IF NOT EXISTS advanced_available    BOOLEAN NOT NULL DEFAULT FALSE;

-- profiles previously had no RLS at all (blocked anon reads outright).
-- It's now the publicly-browsable shop record, so it needs the same
-- public-read / owner-write shape every other public table already has.
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_public_read" ON profiles;
CREATE POLICY "profiles_public_read"
  ON profiles FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "profiles_owner_update" ON profiles;
CREATE POLICY "profiles_owner_update"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);


-- ── 2. Backfill the existing multi-printer owner's shop profile ────

WITH agg AS (
  SELECT
    owner_id,
    array_agg(DISTINCT m) FILTER (WHERE m IS NOT NULL) AS all_materials,
    MIN(price_min) AS min_price,
    MAX(price_max) AS max_price
  FROM printers, unnest(materials) AS m
  WHERE owner_id = 'c488f63d-01a7-4bec-b64e-8a53d8049149'
  GROUP BY owner_id
),
seed AS (
  SELECT * FROM printers WHERE id = '0316d0a1-50b2-4289-ab1f-f4c83ae96787'
)
UPDATE profiles SET
  description          = seed.description,
  print_types           = seed.print_types,
  materials             = agg.all_materials,
  max_size              = seed.max_size,
  price_min             = agg.min_price,
  price_max             = agg.max_price,
  turnaround            = seed.turnaround,
  whatsapp              = COALESCE(profiles.whatsapp, seed.contact_phone),
  sample_photos         = seed.sample_photos,
  lat                   = seed.lat,
  lng                   = seed.lng,
  available             = seed.available,
  rating                = (SELECT ROUND(AVG(r.rating)::NUMERIC, 1) FROM reviews r JOIN printers pr ON pr.id = r.printer_id WHERE pr.owner_id = seed.owner_id),
  review_count          = (SELECT COUNT(*) FROM reviews r JOIN printers pr ON pr.id = r.printer_id WHERE pr.owner_id = seed.owner_id),
  pickup_address        = seed.pickup_address,
  delivery_available    = seed.delivery_available,
  delivery_rate_per_km  = seed.delivery_rate_per_km,
  electricity_rate      = seed.electricity_rate,
  markup_percent        = seed.markup_percent,
  waste_percent         = seed.waste_percent,
  advanced_available    = seed.advanced_available
FROM seed, agg
WHERE profiles.id = seed.owner_id
  AND agg.owner_id = seed.owner_id;


-- ── 3. requests: printer_id -> owner_id ─────────────────────

ALTER TABLE requests ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES profiles(id);

UPDATE requests SET owner_id = (
  SELECT owner_id FROM printers WHERE printers.id = requests.printer_id
) WHERE owner_id IS NULL;

ALTER TABLE requests ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE requests ALTER COLUMN printer_id DROP NOT NULL;

DROP POLICY IF EXISTS "requests_owner_read" ON requests;
CREATE POLICY "requests_owner_read"
  ON requests FOR SELECT
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "requests_owner_update" ON requests;
CREATE POLICY "requests_owner_update"
  ON requests FOR UPDATE
  USING (owner_id = auth.uid());


-- ── 4. catalog_items: printer_id -> owner_id ────────────────

ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES profiles(id);

UPDATE catalog_items SET owner_id = (
  SELECT owner_id FROM printers WHERE printers.id = catalog_items.printer_id
) WHERE owner_id IS NULL;

ALTER TABLE catalog_items ALTER COLUMN owner_id SET NOT NULL;

DROP POLICY IF EXISTS "catalog_items_owner_all" ON catalog_items;
CREATE POLICY "catalog_items_owner_all"
  ON catalog_items FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

ALTER TABLE catalog_items DROP COLUMN IF EXISTS printer_id;


-- ── 5. reviews: printer_id -> owner_id ───────────────────────

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES profiles(id);

UPDATE reviews SET owner_id = (
  SELECT owner_id FROM printers WHERE printers.id = reviews.printer_id
) WHERE owner_id IS NULL;

ALTER TABLE reviews ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE reviews DROP COLUMN IF EXISTS printer_id;


-- ── 6. Rating trigger moves from printers to profiles ───────

DROP TRIGGER IF EXISTS on_review_created ON reviews;
DROP FUNCTION IF EXISTS update_printer_rating();

CREATE OR REPLACE FUNCTION update_shop_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles
  SET
    rating = (SELECT ROUND(AVG(rating)::NUMERIC, 1) FROM reviews WHERE owner_id = NEW.owner_id),
    review_count = (SELECT COUNT(*) FROM reviews WHERE owner_id = NEW.owner_id)
  WHERE id = NEW.owner_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_review_created
  AFTER INSERT ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_shop_rating();


-- ── 7. Note: old storefront columns on `printers` are left in ────
-- place (name, description, price_min, price_max, turnaround,
-- contact_phone, sample_photos, lat, lng, available, rating,
-- review_count, pickup_address, delivery_available,
-- delivery_rate_per_km) — unused after this migration, but kept for
-- one release as a safety net. Drop them in a follow-up migration
-- once the new code path is verified in production.

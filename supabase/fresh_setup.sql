-- ============================================================
-- Qid3D Studio — Consolidated Clean Schema for Fresh Setup
-- ============================================================

-- ── 1. PROFILES (1:1 with auth.users & Studio Storefront) ──
CREATE TABLE IF NOT EXISTS public.profiles (
  id                    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  whatsapp              TEXT,
  description           TEXT NOT NULL DEFAULT 'Precision custom 3D printing & rapid prototyping studio in Ampang, Selangor.',
  print_types           TEXT[] NOT NULL DEFAULT '{"custom", "prototyping", "functional"}',
  materials             TEXT[] NOT NULL DEFAULT '{"pla", "petg", "tpu"}',
  max_size              TEXT NOT NULL DEFAULT '220 x 220 x 250 mm',
  price_min             NUMERIC(10, 2) NOT NULL DEFAULT 5.00,
  price_max             NUMERIC(10, 2) NOT NULL DEFAULT 250.00,
  turnaround            TEXT NOT NULL DEFAULT '24 - 48 Hours',
  sample_photos         TEXT[] DEFAULT '{}',
  lat                   FLOAT DEFAULT 3.1499,
  lng                   FLOAT DEFAULT 101.7617,
  available             BOOLEAN DEFAULT TRUE,
  rating                NUMERIC(3, 1) DEFAULT 5.0,
  review_count          INT DEFAULT 12,
  pickup_address        TEXT DEFAULT 'Ampang, Selangor (Near LRT Ampang)',
  delivery_available    BOOLEAN DEFAULT TRUE,
  delivery_rate_per_km  NUMERIC(10, 2) DEFAULT 1.00,
  electricity_rate      NUMERIC(10, 4) DEFAULT 0.57,
  markup_percent        NUMERIC(5, 2) DEFAULT 30,
  waste_percent         NUMERIC(5, 2) DEFAULT 8,
  advanced_available    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_public_read" ON public.profiles;
CREATE POLICY "profiles_public_read" ON public.profiles FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "profiles_owner_insert" ON public.profiles;
CREATE POLICY "profiles_owner_insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_owner_update" ON public.profiles;
CREATE POLICY "profiles_owner_update" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Auto-create profile trigger on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, whatsapp)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'whatsapp'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ── 2. PRINTERS (Hardware Equipment) ───────────────────────
CREATE TABLE IF NOT EXISTS public.printers (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id              UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  printer_model         TEXT NOT NULL DEFAULT 'Creality Ender-3 V3 SE',
  printer_model_id      TEXT DEFAULT 'ender-3-v3-se',
  filament_costs        JSONB DEFAULT '{"pla": 55, "petg": 65, "tpu": 85}'::jsonb,
  power_watts           INT DEFAULT 350,
  machine_rate_per_hour NUMERIC(10, 2) DEFAULT 5.00,
  bed_type              TEXT DEFAULT 'Smooth PEI Steel Sheet',
  grams_per_roll        INT DEFAULT 1000,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.printers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "printers_public_read" ON public.printers;
CREATE POLICY "printers_public_read" ON public.printers FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "printers_owner_all" ON public.printers;
CREATE POLICY "printers_owner_all" ON public.printers FOR ALL USING (auth.uid() = owner_id);


-- ── 3. FILAMENTS (Spool Inventory) ─────────────────────────
CREATE TABLE IF NOT EXISTS public.filaments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  material        TEXT NOT NULL,
  color           TEXT NOT NULL,
  color_hex       TEXT NOT NULL DEFAULT '#1a1a1a',
  brand           TEXT DEFAULT 'eSUN',
  cost_per_kg     NUMERIC(10, 2) DEFAULT 55.00,
  grams_remaining NUMERIC(10, 2) DEFAULT 1000.00,
  in_stock        BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.filaments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "filaments_public_read" ON public.filaments;
CREATE POLICY "filaments_public_read" ON public.filaments FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "filaments_owner_all" ON public.filaments;
CREATE POLICY "filaments_owner_all" ON public.filaments FOR ALL USING (auth.uid() = owner_id);


-- ── 4. CATALOG ITEMS (Storefront Products) ─────────────────
CREATE TABLE IF NOT EXISTS public.catalog_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  description       TEXT DEFAULT '',
  price             NUMERIC(10, 2) NOT NULL,
  category          TEXT DEFAULT 'general',
  images            TEXT[] DEFAULT '{}',
  model_url         TEXT,
  materials         TEXT[] DEFAULT '{"pla"}',
  colors            TEXT[] DEFAULT '{"Matte Black"}',
  is_active         BOOLEAN DEFAULT TRUE,
  print_time_hours  NUMERIC(6, 2) DEFAULT 1.5,
  weight_grams      NUMERIC(6, 2) DEFAULT 45,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.catalog_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_public_read" ON public.catalog_items;
CREATE POLICY "catalog_public_read" ON public.catalog_items FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "catalog_owner_all" ON public.catalog_items;
CREATE POLICY "catalog_owner_all" ON public.catalog_items FOR ALL USING (auth.uid() = owner_id);


-- ── 5. REQUESTS (Quotes, Custom Print Jobs & Orders) ───────
CREATE TABLE IF NOT EXISTS public.requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id          UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  printer_id        UUID REFERENCES public.printers(id) ON DELETE SET NULL,
  customer_name     TEXT NOT NULL,
  customer_email    TEXT NOT NULL,
  customer_phone    TEXT NOT NULL,
  description       TEXT NOT NULL,
  file_url          TEXT,
  print_type        TEXT NOT NULL DEFAULT 'custom',
  material          TEXT NOT NULL DEFAULT 'pla',
  color             TEXT DEFAULT 'Matte Black',
  size              TEXT NOT NULL DEFAULT 'medium',
  quality           TEXT NOT NULL DEFAULT 'standard',
  deadline          DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '7 days'),
  notes             TEXT DEFAULT '',
  status            TEXT NOT NULL DEFAULT 'new',
  quoted_price      NUMERIC(10, 2),
  quoted_by_date    DATE,
  quote_message     TEXT,
  shipping_address  TEXT,
  shipping_state    TEXT,
  shipping_cost     NUMERIC(10, 2) DEFAULT 8.00,
  payment_method    TEXT,
  payment_status    TEXT DEFAULT 'unpaid',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "requests_public_read" ON public.requests;
CREATE POLICY "requests_public_read" ON public.requests FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "requests_public_insert" ON public.requests;
CREATE POLICY "requests_public_insert" ON public.requests FOR INSERT WITH CHECK (TRUE);

DROP POLICY IF EXISTS "requests_owner_all" ON public.requests;
CREATE POLICY "requests_owner_all" ON public.requests FOR ALL USING (auth.uid() = owner_id);


-- ── 6. PRINT PROFILES (Quality Tiers & Nozzle Specs) ───────
CREATE TABLE IF NOT EXISTS public.print_profiles (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  printer_id         UUID NOT NULL REFERENCES public.printers(id) ON DELETE CASCADE,
  nozzle_mm          NUMERIC(3, 2) DEFAULT 0.4,
  infill_draft       INT DEFAULT 15,
  infill_standard    INT DEFAULT 20,
  infill_premium     INT DEFAULT 30,
  supports_available BOOLEAN DEFAULT TRUE,
  ironing_available  BOOLEAN DEFAULT FALSE,
  is_default         BOOLEAN DEFAULT TRUE,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.print_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "print_profiles_public_read" ON public.print_profiles;
CREATE POLICY "print_profiles_public_read" ON public.print_profiles FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "print_profiles_owner_all" ON public.print_profiles;
CREATE POLICY "print_profiles_owner_all" ON public.print_profiles FOR ALL USING (
  EXISTS (SELECT 1 FROM public.printers WHERE id = print_profiles.printer_id AND owner_id = auth.uid())
);


-- ── 7. REVIEWS & AFFILIATES ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reviews (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  request_id    UUID REFERENCES public.requests(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  rating        INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment       TEXT DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews_public_read" ON public.reviews FOR SELECT USING (TRUE);

CREATE TABLE IF NOT EXISTS public.affiliates (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code               TEXT NOT NULL UNIQUE,
  name               TEXT NOT NULL,
  commission_percent NUMERIC(5, 2) DEFAULT 10.00,
  total_referrals    INT DEFAULT 0,
  total_earned       NUMERIC(10, 2) DEFAULT 0.00,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "affiliates_public_read" ON public.affiliates FOR SELECT USING (TRUE);
CREATE POLICY "affiliates_owner_all" ON public.affiliates FOR ALL USING (auth.uid() = owner_id);


-- ── 8. STORAGE BUCKET (stl-files) ──────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('stl-files', 'stl-files', TRUE)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "stl_files_public_select" ON storage.objects;
CREATE POLICY "stl_files_public_select" ON storage.objects FOR SELECT USING (bucket_id = 'stl-files');

DROP POLICY IF EXISTS "stl_files_public_insert" ON storage.objects;
CREATE POLICY "stl_files_public_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'stl-files');

DROP POLICY IF EXISTS "stl_files_public_update" ON storage.objects;
CREATE POLICY "stl_files_public_update" ON storage.objects FOR UPDATE USING (bucket_id = 'stl-files');

DROP POLICY IF EXISTS "stl_files_public_delete" ON storage.objects;
CREATE POLICY "stl_files_public_delete" ON storage.objects FOR DELETE USING (bucket_id = 'stl-files');

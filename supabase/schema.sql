-- ============================================================
-- Print3DHub — Supabase Schema
-- Run this in the Supabase SQL Editor (supabase.com → SQL Editor)
-- ============================================================


-- ── 1. PROFILES ─────────────────────────────────────────────
-- Linked 1:1 to auth.users. Created automatically on signup.

CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  whatsapp    TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile when a user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ── 2. PRINTERS ─────────────────────────────────────────────

CREATE TABLE printers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  description    TEXT NOT NULL,
  printer_model  TEXT NOT NULL,
  print_types    TEXT[] NOT NULL DEFAULT '{}',
  materials      TEXT[] NOT NULL DEFAULT '{}',
  max_size       TEXT NOT NULL DEFAULT 'medium',
  price_min      NUMERIC(10, 2) NOT NULL,
  price_max      NUMERIC(10, 2) NOT NULL,
  turnaround     TEXT NOT NULL,
  contact_phone  TEXT NOT NULL,
  sample_photos  TEXT[] DEFAULT '{}',
  lat            FLOAT,
  lng            FLOAT,
  available      BOOLEAN DEFAULT TRUE,
  rating         NUMERIC(3, 1) DEFAULT 0,
  review_count   INT DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Row-Level Security
ALTER TABLE printers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "printers_public_read"
  ON printers FOR SELECT USING (TRUE);

CREATE POLICY "printers_owner_insert"
  ON printers FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "printers_owner_update"
  ON printers FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "printers_owner_delete"
  ON printers FOR DELETE
  USING (auth.uid() = owner_id);


-- ── 3. REQUESTS ─────────────────────────────────────────────

CREATE TABLE requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  printer_id      UUID NOT NULL REFERENCES printers(id) ON DELETE CASCADE,
  customer_name   TEXT NOT NULL,
  customer_email  TEXT NOT NULL,
  customer_phone  TEXT NOT NULL,
  description     TEXT NOT NULL,
  file_url        TEXT,
  print_type      TEXT NOT NULL,
  material        TEXT NOT NULL,
  size            TEXT NOT NULL,
  quality         TEXT NOT NULL,
  deadline        DATE NOT NULL,
  notes           TEXT DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'new',
  quoted_price    NUMERIC(10, 2),
  quoted_by_date  DATE,
  quote_message   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_status CHECK (
    status IN (
      'new', 'quoted', 'accepted', 'printing',
      'done', 'collected', 'declined', 'cancelled', 'reviewed'
    )
  )
);

-- Row-Level Security
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;

-- Anyone can submit a request (no auth needed)
CREATE POLICY "requests_public_insert"
  ON requests FOR INSERT WITH CHECK (TRUE);

-- Only the printer owner can read their own requests
CREATE POLICY "requests_owner_read"
  ON requests FOR SELECT
  USING (
    printer_id IN (
      SELECT id FROM printers WHERE owner_id = auth.uid()
    )
  );

-- Only the printer owner can update request status/quote
CREATE POLICY "requests_owner_update"
  ON requests FOR UPDATE
  USING (
    printer_id IN (
      SELECT id FROM printers WHERE owner_id = auth.uid()
    )
  );


-- ── 4. REVIEWS ──────────────────────────────────────────────

CREATE TABLE reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id  UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE UNIQUE,
  printer_id  UUID NOT NULL REFERENCES printers(id) ON DELETE CASCADE,
  rating      INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Row-Level Security
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reviews_public_read"
  ON reviews FOR SELECT USING (TRUE);

-- Anyone can insert a review (link is sent via email, no auth needed)
CREATE POLICY "reviews_public_insert"
  ON reviews FOR INSERT WITH CHECK (TRUE);


-- ── 5. AUTO-UPDATE PRINTER RATING ───────────────────────────
-- Recalculates rating + review_count whenever a review is added

CREATE OR REPLACE FUNCTION update_printer_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE printers
  SET
    rating = (
      SELECT ROUND(AVG(rating)::NUMERIC, 1)
      FROM reviews
      WHERE printer_id = NEW.printer_id
    ),
    review_count = (
      SELECT COUNT(*) FROM reviews WHERE printer_id = NEW.printer_id
    )
  WHERE id = NEW.printer_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_review_created
  AFTER INSERT ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_printer_rating();


-- ── 6. SUPABASE STORAGE BUCKET ──────────────────────────────
-- Run separately in the Storage section of your Supabase dashboard,
-- or uncomment and run here:

-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('print-files', 'print-files', false);

-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('printer-photos', 'printer-photos', true);

CREATE TABLE IF NOT EXISTS print_profiles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  printer_id          UUID NOT NULL REFERENCES printers(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  nozzle_mm           NUMERIC(3,1) NOT NULL DEFAULT 0.4,
  infill_draft        INT NOT NULL DEFAULT 15,
  infill_standard     INT NOT NULL DEFAULT 25,
  infill_premium      INT NOT NULL DEFAULT 40,
  supports_available  BOOLEAN NOT NULL DEFAULT TRUE,
  ironing_available   BOOLEAN NOT NULL DEFAULT FALSE,
  is_default          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE print_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "print_profiles_public_read"
  ON print_profiles FOR SELECT USING (TRUE);

CREATE POLICY "print_profiles_owner_all"
  ON print_profiles FOR ALL
  USING (
    printer_id IN (SELECT id FROM printers WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    printer_id IN (SELECT id FROM printers WHERE owner_id = auth.uid())
  );

ALTER TABLE printers
  ADD COLUMN IF NOT EXISTS power_watts       INT,
  ADD COLUMN IF NOT EXISTS filament_costs    JSONB,
  ADD COLUMN IF NOT EXISTS electricity_rate  NUMERIC(6,4),
  ADD COLUMN IF NOT EXISTS markup_percent    INT,
  ADD COLUMN IF NOT EXISTS grams_per_roll    INT,
  ADD COLUMN IF NOT EXISTS printer_model_id  TEXT;

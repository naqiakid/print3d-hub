import pg from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('DATABASE_URL environment variable is required')
  process.exit(1)
}

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
})

async function deploy() {
  console.log('Connecting to new Supabase Postgres (zsejgcikbrutllqgfnlu)...')
  await client.connect()
  console.log('Connected!')

  const sqlPath = path.resolve(__dirname, '../supabase/fresh_setup.sql')
  const sql = fs.readFileSync(sqlPath, 'utf8')

  console.log('Running fresh_setup.sql...')
  await client.query(sql)
  console.log('Successfully applied fresh_setup.sql!')

  // Auto-confirm trigger
  console.log('Applying auto-confirm trigger...')
  await client.query(`
    CREATE OR REPLACE FUNCTION public.auto_confirm_user()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.email_confirmed_at = COALESCE(NEW.email_confirmed_at, NOW());
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;

    DROP TRIGGER IF EXISTS on_auth_user_before_insert ON auth.users;
    CREATE TRIGGER on_auth_user_before_insert
      BEFORE INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.auto_confirm_user();
  `)

  // Auto-provision trigger (Ender-3 V3 SE + PLA/PETG/TPU spools)
  console.log('Applying auto-provision trigger...')
  await client.query(`
    CREATE OR REPLACE FUNCTION public.handle_new_user()
    RETURNS TRIGGER AS $$
    DECLARE
      new_printer_id UUID;
    BEGIN
      -- 1. Create Studio Profile
      INSERT INTO public.profiles (
        id, 
        name, 
        whatsapp, 
        description, 
        pickup_address, 
        available, 
        print_types, 
        materials, 
        max_size,
        price_min,
        price_max,
        turnaround,
        delivery_available,
        delivery_rate_per_km,
        electricity_rate,
        markup_percent,
        waste_percent,
        advanced_available
      )
      VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', 'Qid3D Studio Owner'),
        COALESCE(NEW.raw_user_meta_data->>'whatsapp', '+60123456789'),
        'Precision custom 3D printing & rapid prototyping studio in Ampang, Selangor.',
        'Ampang, Selangor, Malaysia',
        TRUE,
        ARRAY['custom', 'prototyping', 'functional'],
        ARRAY['pla', 'petg', 'tpu'],
        '220 x 220 x 250 mm',
        5.00,
        250.00,
        '24 - 48 Hours',
        TRUE,
        1.00,
        0.57,
        30.00,
        8.00,
        TRUE
      )
      ON CONFLICT (id) DO NOTHING;

      -- 2. Create Primary Printer (Creality Ender-3 V3 SE)
      INSERT INTO public.printers (
        owner_id,
        printer_model,
        printer_model_id,
        filament_costs,
        power_watts,
        machine_rate_per_hour,
        bed_type,
        grams_per_roll
      )
      VALUES (
        NEW.id,
        'Creality Ender-3 V3 SE',
        'ender-3-v3-se',
        '{"pla": 55, "petg": 65, "tpu": 85}'::jsonb,
        350,
        5.00,
        'Smooth PEI Steel Sheet',
        1000
      )
      RETURNING id INTO new_printer_id;

      -- 3. Create Default Print Profiles
      IF new_printer_id IS NOT NULL THEN
        INSERT INTO public.print_profiles (printer_id, nozzle_mm, infill_draft, infill_standard, infill_premium, supports_available, ironing_available, is_default)
        VALUES 
          (new_printer_id, 0.4, 15, 20, 30, TRUE, FALSE, TRUE);
      END IF;

      -- 4. Create Initial Filament Spools (PLA, PETG, TPU)
      INSERT INTO public.filaments (owner_id, material, color, color_hex, brand, cost_per_kg, grams_remaining, in_stock)
      VALUES
        (NEW.id, 'pla', 'Matte Black', '#1a1a1a', 'eSUN PLA+', 55.00, 850.00, TRUE),
        (NEW.id, 'pla', 'Pure White', '#f8fafc', 'eSUN PLA+', 55.00, 920.00, TRUE),
        (NEW.id, 'pla', 'Vibrant Orange', '#f97316', 'eSUN PLA+', 55.00, 750.00, TRUE),
        (NEW.id, 'petg', 'Clean White', '#ffffff', 'Sunlu PETG', 65.00, 1000.00, TRUE),
        (NEW.id, 'petg', 'Solid Black', '#111827', 'Sunlu PETG', 65.00, 600.00, TRUE),
        (NEW.id, 'tpu', 'Flexible Black', '#18181b', 'Overture TPU 95A', 85.00, 500.00, TRUE);

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  `)

  // Check tables created
  const res = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `)
  console.log('Public tables successfully created in new project:', res.rows.map(r => r.table_name))

  await client.end()
}

deploy().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})

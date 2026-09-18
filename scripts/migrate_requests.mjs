import pg from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

async function migrate() {
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  console.log('Connected to PostgreSQL...');

  await client.query(`
    ALTER TABLE public.requests
      ADD COLUMN IF NOT EXISTS stl_urls TEXT[],
      ADD COLUMN IF NOT EXISTS weight_g NUMERIC(10, 1),
      ADD COLUMN IF NOT EXISTS print_hours NUMERIC(10, 2),
      ADD COLUMN IF NOT EXISTS fulfillment TEXT DEFAULT 'pickup',
      ADD COLUMN IF NOT EXISTS delivery_address TEXT,
      ADD COLUMN IF NOT EXISTS delivery_cost NUMERIC(10, 2),
      ADD COLUMN IF NOT EXISTS quote_model_url TEXT,
      ADD COLUMN IF NOT EXISTS gcode_urls TEXT[],
      ADD COLUMN IF NOT EXISTS catalog_item_id UUID,
      ADD COLUMN IF NOT EXISTS color_preferences JSONB,
      ADD COLUMN IF NOT EXISTS selected_addons TEXT[],
      ADD COLUMN IF NOT EXISTS confirmed_addons TEXT[],
      ADD COLUMN IF NOT EXISTS declined_addons TEXT[];
  `);
  console.log('Successfully updated public.requests columns!');

  const res = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'requests' AND table_schema = 'public'
    ORDER BY ordinal_position;
  `);
  console.log('New columns list:', res.rows.map(r => `${r.column_name} (${r.data_type})`));

  await client.end();
}

migrate().catch(console.error);

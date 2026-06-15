-- Product catalog: owner-curated prints available to order with customisation options.

CREATE TABLE IF NOT EXISTS catalog_items (
  id                    uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  printer_id            uuid        NOT NULL REFERENCES printers(id) ON DELETE CASCADE,
  name                  text        NOT NULL,
  description           text        NOT NULL DEFAULT '',
  photo_url             text,                         -- single showcase photo
  model_url             text,                         -- link to original design
  stl_urls              text[]      NOT NULL DEFAULT '{}',  -- uploaded model files for 3D preview

  -- Customisation the owner offers for this product
  allow_custom_text     boolean     NOT NULL DEFAULT false,
  text_prompt           text        NOT NULL DEFAULT 'Text to add',
  allow_color_choice    boolean     NOT NULL DEFAULT true,
  allow_resize          boolean     NOT NULL DEFAULT false,
  resize_min_pct        integer     NOT NULL DEFAULT 80,
  resize_max_pct        integer     NOT NULL DEFAULT 150,
  allow_material_choice boolean     NOT NULL DEFAULT false,
  available_materials   text[]      NOT NULL DEFAULT '{}',  -- empty = use printer's materials

  base_price            decimal(10,2),
  sort_order            integer     NOT NULL DEFAULT 0,
  is_active             boolean     NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE catalog_items ENABLE ROW LEVEL SECURITY;

-- Anyone can browse active products
CREATE POLICY "catalog_items_public_read"
  ON catalog_items FOR SELECT
  USING (is_active = true);

-- Owner (authenticated) can manage their own items
CREATE POLICY "catalog_items_owner_all"
  ON catalog_items FOR ALL
  USING  (printer_id IN (SELECT id FROM printers WHERE owner_id = auth.uid()))
  WITH CHECK (printer_id IN (SELECT id FROM printers WHERE owner_id = auth.uid()));

-- Link requests to catalog items
ALTER TABLE requests ADD COLUMN IF NOT EXISTS catalog_item_id uuid REFERENCES catalog_items(id);

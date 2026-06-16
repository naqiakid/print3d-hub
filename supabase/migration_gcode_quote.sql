-- Preview image uploaded by owner when sending a quote
-- (slicer screenshot showing model with correct color + text placement)
ALTER TABLE requests ADD COLUMN IF NOT EXISTS quote_preview_url text;

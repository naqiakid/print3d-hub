-- 3D model file uploaded by owner when sending a quote
-- Customer views it in 360° on the track page before confirming
ALTER TABLE requests ADD COLUMN IF NOT EXISTS quote_model_url text;

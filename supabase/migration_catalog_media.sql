-- Add photo_urls (array of uploaded product photos) and video_url to catalog_items.
-- photo_url (singular) is kept for back-compat; photo_urls is the new primary field.

ALTER TABLE catalog_items
  ADD COLUMN IF NOT EXISTS photo_urls  text[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS video_url   text;

-- Back-fill: if a row already has a photo_url, seed it into the new array
-- so existing products keep their cover image.
UPDATE catalog_items
SET photo_urls = ARRAY[photo_url]
WHERE photo_url IS NOT NULL
  AND (photo_urls IS NULL OR array_length(photo_urls, 1) IS NULL);

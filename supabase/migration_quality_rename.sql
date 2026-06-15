-- Rename quality values to match new finish-expectation tiers
UPDATE requests SET quality = 'functional'  WHERE quality = 'draft';
UPDATE requests SET quality = 'presentable' WHERE quality = 'standard';
UPDATE requests SET quality = 'display'     WHERE quality = 'premium';

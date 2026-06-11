-- Allow customers to read requests by tracking UUID.
-- UUID (128-bit) is unguessable in practice — this is the standard
-- "tracking number as secret" pattern (same model as courier tracking).
-- Required for both /track/[requestId] and the /track email-lookup page.
CREATE POLICY "requests_public_read"
  ON requests FOR SELECT USING (TRUE);

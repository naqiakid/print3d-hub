-- Allow customers to revise their request (material, color, options) before the owner accepts.
-- Status reverts to 'new' on revision so the owner re-reviews.
-- UUID security model: knowing the ID = authorization (same as accept/decline).
CREATE POLICY "requests_customer_revise"
  ON requests FOR UPDATE
  USING (status IN ('new', 'quoted'))
  WITH CHECK (status = 'new');

-- Allow customers to accept or decline a quoted request.
-- USING: only rows where status is currently 'quoted' can be targeted.
-- WITH CHECK: the new status must be 'accepted' or 'cancelled'.
-- Security: the request UUID is 128-bit and unguessable — knowing the ID is
-- the same as knowing a courier tracking number, which is the intended model.
CREATE POLICY "requests_customer_accept_decline"
  ON requests FOR UPDATE
  USING (status = 'quoted')
  WITH CHECK (status IN ('accepted', 'cancelled'));

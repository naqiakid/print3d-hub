-- ============================================================
-- Migration: Allow customers to submit a review after collection
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Customers can mark their own request as 'reviewed' once it's been collected
-- (same no-auth, unguessable-UUID security model as requests_customer_accept_decline).
CREATE POLICY "requests_customer_review"
  ON requests FOR UPDATE
  USING (status = 'collected')
  WITH CHECK (status = 'reviewed');

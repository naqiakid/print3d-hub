-- Migration to add 'shipping' request status.
-- Run this in your Supabase SQL Editor.

-- Drop the old constraint
ALTER TABLE requests DROP CONSTRAINT IF EXISTS valid_status;

-- Re-create the constraint with 'shipping' included
ALTER TABLE requests ADD CONSTRAINT valid_status CHECK (
  status IN (
    'new', 'quoted', 'accepted', 'printing',
    'done', 'shipping', 'collected', 'declined', 'cancelled', 'reviewed'
  )
);

-- Fix Time Entry Statuses
-- This migration fixes any time entries where the status doesn't match the clock out state

-- Step 1: Update entries that have been clocked out but still show as pending_clock_in
-- These should be pending_approval
UPDATE time_entries
SET
  status = 'pending_approval',
  updated_at = NOW()
WHERE
  clock_out_reported_at IS NOT NULL
  AND status = 'pending_clock_in';

-- Step 2: Fix any entries that show pending_approval but don't have clock_out
-- These should be pending_clock_in
UPDATE time_entries
SET
  status = 'pending_clock_in',
  updated_at = NOW()
WHERE
  clock_out_reported_at IS NULL
  AND status = 'pending_approval';

-- Verify the fix
SELECT
  COUNT(*) as total_entries,
  SUM(CASE WHEN status = 'pending_clock_in' THEN 1 ELSE 0 END) as still_clocked_in,
  SUM(CASE WHEN status = 'pending_approval' THEN 1 ELSE 0 END) as awaiting_approval,
  SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
  SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
FROM time_entries;

-- Show problematic entries (should be zero after fix)
-- Only check for the main issue: entries with clock_out that are still pending_clock_in
SELECT
  id,
  employee_id,
  clock_in_reported_at,
  clock_out_reported_at,
  status,
  CASE
    WHEN status = 'pending_clock_in' AND clock_out_reported_at IS NOT NULL
      THEN 'ERROR: pending_clock_in with clock_out'
    WHEN status = 'pending_approval' AND clock_out_reported_at IS NULL
      THEN 'WARNING: pending_approval without clock_out (unusual but allowed)'
    ELSE 'OK'
  END as validation_status
FROM time_entries
WHERE
  (status = 'pending_clock_in' AND clock_out_reported_at IS NOT NULL) OR
  (status = 'pending_approval' AND clock_out_reported_at IS NULL);

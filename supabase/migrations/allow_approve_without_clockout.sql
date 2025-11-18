-- Allow approving time entries without clock_out
-- This removes the constraint that required clock_out for approval status

-- Drop the constraint if it exists
ALTER TABLE time_entries
DROP CONSTRAINT IF EXISTS valid_status_clock_out_combination;

-- Now we allow:
-- - pending_clock_in: Employee clocked in, may or may not have clocked out
-- - pending_approval: Clocked out and waiting for approval
-- - approved: Can be approved with just clock_in (partial approval) or with both times
-- - rejected: Can be rejected at any point

-- Note: The original constraint prevented flexible approval workflows
-- Owners can now approve clock-ins even if employee is still working

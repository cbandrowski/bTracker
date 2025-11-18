-- Fix Employee Time Entry Update Policy
-- Allow employees to update their own time entries when clocking out

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Employees can update their own pending time entries" ON time_entries;

-- Create new policy that allows employees to update their own entries
-- This allows them to clock out (change from pending_clock_in to pending_approval)
CREATE POLICY "Employees can update their own time entries"
ON time_entries
FOR UPDATE
USING (
  employee_id IN (
    SELECT id
    FROM company_employees
    WHERE profile_id = auth.uid()
  )
  -- Allow updates when status is pending_clock_in OR pending_approval
  -- This allows clock-out and also allows employees to update if owner sends back for correction
  AND status IN ('pending_clock_in', 'pending_approval')
)
WITH CHECK (
  -- After update, employee_id must still match (can't reassign to another employee)
  employee_id IN (
    SELECT id
    FROM company_employees
    WHERE profile_id = auth.uid()
  )
  -- Allow status to change to pending_approval (clock out) or stay as pending_clock_in
  AND status IN ('pending_clock_in', 'pending_approval')
);

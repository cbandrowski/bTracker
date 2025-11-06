-- Add approval status to company_employees table
-- This allows owners to approve employees before they can access the system

-- Add approval_status column
ALTER TABLE company_employees
ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'pending'
CHECK (approval_status IN ('pending', 'approved', 'rejected'));

-- Add work_status column for tracking employee availability
-- This is separate from employment_status which tracks active/on_leave/terminated
ALTER TABLE company_employees
ADD COLUMN IF NOT EXISTS work_status TEXT NOT NULL DEFAULT 'available'
CHECK (work_status IN ('available', 'inactive', 'vacation', 'sick'));

-- Create index for filtering by approval status
CREATE INDEX IF NOT EXISTS idx_company_employees_approval_status
ON company_employees(company_id, approval_status);

-- Create index for filtering by work status
CREATE INDEX IF NOT EXISTS idx_company_employees_work_status
ON company_employees(company_id, work_status);

-- DEV MODE: Allow all authenticated users to view company_employees
CREATE POLICY "dev_authenticated_users_can_view_employees"
    ON company_employees FOR SELECT
    USING (auth.uid() IS NOT NULL);

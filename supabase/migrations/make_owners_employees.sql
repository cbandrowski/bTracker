-- Migration: Make owners also employees
-- This allows owners to be assigned to jobs just like regular employees

-- Step 1: Create function to ensure an owner has an employee record
CREATE OR REPLACE FUNCTION ensure_owner_is_employee()
RETURNS TRIGGER AS $$
BEGIN
    -- When a new owner is added or updated, ensure they have an employee record
    INSERT INTO company_employees (
        company_id,
        profile_id,
        hire_date,
        job_title,
        employment_status,
        approval_status,
        work_status,
        is_manager
    )
    VALUES (
        NEW.company_id,
        NEW.profile_id,
        CURRENT_DATE,  -- Set hire_date to today
        'Owner',       -- Job title set to "Owner"
        'active',      -- Employment status is active
        'approved',    -- Owners are auto-approved
        'available',   -- Work status is available
        true           -- Owners are managers
    )
    ON CONFLICT (company_id, profile_id) DO UPDATE
    SET
        -- If they already exist as an employee, update to ensure they have manager privileges
        is_manager = true,
        employment_status = 'active',
        approval_status = 'approved',
        -- Only update job_title to 'Owner' if it's not already set to something else
        -- This allows owners to have custom job titles if they prefer
        job_title = CASE
            WHEN company_employees.job_title IS NULL OR company_employees.job_title = ''
            THEN 'Owner'
            ELSE company_employees.job_title
        END,
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Create trigger on company_owners table
-- This trigger fires whenever a new owner is added
DROP TRIGGER IF EXISTS trigger_ensure_owner_is_employee ON company_owners;
CREATE TRIGGER trigger_ensure_owner_is_employee
    AFTER INSERT OR UPDATE ON company_owners
    FOR EACH ROW
    EXECUTE FUNCTION ensure_owner_is_employee();

-- Step 3: Backfill existing owners to be employees
-- This updates any existing owners who don't have employee records
INSERT INTO company_employees (
    company_id,
    profile_id,
    hire_date,
    job_title,
    employment_status,
    approval_status,
    work_status,
    is_manager
)
SELECT
    co.company_id,
    co.profile_id,
    COALESCE(co.created_at::date, CURRENT_DATE) as hire_date,  -- Use when they became owner, or today
    'Owner' as job_title,
    'active' as employment_status,
    'approved' as approval_status,
    'available' as work_status,
    true as is_manager
FROM company_owners co
WHERE NOT EXISTS (
    -- Only insert if they don't already have an employee record
    SELECT 1 FROM company_employees ce
    WHERE ce.company_id = co.company_id
    AND ce.profile_id = co.profile_id
)
ON CONFLICT (company_id, profile_id) DO UPDATE
SET
    is_manager = true,
    employment_status = 'active',
    approval_status = 'approved',
    job_title = CASE
        WHEN company_employees.job_title IS NULL OR company_employees.job_title = ''
        THEN 'Owner'
        ELSE company_employees.job_title
    END,
    updated_at = NOW();

-- Step 4: Create helper function to get employee_id for current user
-- This makes it easy to find the employee record for self-assignment
CREATE OR REPLACE FUNCTION get_my_employee_id(p_company_id UUID)
RETURNS UUID AS $$
DECLARE
    v_employee_id UUID;
BEGIN
    -- Look up the employee record for the current authenticated user in the specified company
    SELECT id INTO v_employee_id
    FROM company_employees
    WHERE profile_id = auth.uid()
    AND company_id = p_company_id
    AND employment_status = 'active'
    AND approval_status = 'approved';

    RETURN v_employee_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_my_employee_id(UUID) TO authenticated;

COMMENT ON FUNCTION get_my_employee_id(UUID) IS
'Helper function to get the employee_id for the current authenticated user in a specific company. Returns NULL if no active, approved employee record exists.';

-- Step 5: Add helpful comments
COMMENT ON FUNCTION ensure_owner_is_employee() IS
'Automatically creates or updates an employee record whenever someone becomes a company owner. This ensures owners can be assigned to jobs.';

COMMENT ON TRIGGER trigger_ensure_owner_is_employee ON company_owners IS
'Ensures that every company owner also has an employee record, allowing them to be assigned to jobs.';

-- Development mode: Open up all permissions for easy access
-- WARNING: DO NOT USE IN PRODUCTION

-- Drop all existing restrictive policies on jobs
DROP POLICY IF EXISTS "Company owners can view their jobs" ON jobs;
DROP POLICY IF EXISTS "Company owners can insert their jobs" ON jobs;
DROP POLICY IF EXISTS "Company owners can update their jobs" ON jobs;
DROP POLICY IF EXISTS "Company owners can delete their jobs" ON jobs;
DROP POLICY IF EXISTS "Employees can view their assigned jobs" ON jobs;

-- Drop all existing restrictive policies on job_assignments
DROP POLICY IF EXISTS "Company owners can view job assignments" ON job_assignments;
DROP POLICY IF EXISTS "Company owners can insert job assignments" ON job_assignments;
DROP POLICY IF EXISTS "Company owners can update job assignments" ON job_assignments;
DROP POLICY IF EXISTS "Company owners can delete job assignments" ON job_assignments;
DROP POLICY IF EXISTS "Employees can view their assignments" ON job_assignments;
DROP POLICY IF EXISTS "Employees can update their assignment status" ON job_assignments;

-- Create wide-open policies for jobs table
CREATE POLICY "dev_jobs_select" ON jobs FOR SELECT USING (true);
CREATE POLICY "dev_jobs_insert" ON jobs FOR INSERT WITH CHECK (true);
CREATE POLICY "dev_jobs_update" ON jobs FOR UPDATE USING (true);
CREATE POLICY "dev_jobs_delete" ON jobs FOR DELETE USING (true);

-- Create wide-open policies for job_assignments table
CREATE POLICY "dev_assignments_select" ON job_assignments FOR SELECT USING (true);
CREATE POLICY "dev_assignments_insert" ON job_assignments FOR INSERT WITH CHECK (true);
CREATE POLICY "dev_assignments_update" ON job_assignments FOR UPDATE USING (true);
CREATE POLICY "dev_assignments_delete" ON job_assignments FOR DELETE USING (true);

-- Make sure the trigger function can still update jobs
-- (This should already be set from the previous migration, but ensuring it)
DROP FUNCTION IF EXISTS update_job_status_from_assignments() CASCADE;

CREATE OR REPLACE FUNCTION update_job_status_from_assignments()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    target_job_id UUID;
    total_assignments INTEGER;
    done_assignments INTEGER;
    in_progress_assignments INTEGER;
    current_job_status TEXT;
BEGIN
    -- Get the job_id from the trigger event
    target_job_id := COALESCE(NEW.job_id, OLD.job_id);

    -- Get current job status
    SELECT status INTO current_job_status FROM jobs WHERE id = target_job_id;

    -- Count total non-cancelled assignments for this job
    SELECT COUNT(*) INTO total_assignments
    FROM job_assignments
    WHERE job_id = target_job_id
    AND assignment_status != 'cancelled';

    -- Count done assignments
    SELECT COUNT(*) INTO done_assignments
    FROM job_assignments
    WHERE job_id = target_job_id
    AND assignment_status = 'done';

    -- Count in-progress assignments
    SELECT COUNT(*) INTO in_progress_assignments
    FROM job_assignments
    WHERE job_id = target_job_id
    AND assignment_status = 'in_progress';

    -- Log for debugging
    RAISE NOTICE 'Job ID: %, Total: %, Done: %, In Progress: %, Current Status: %',
        target_job_id, total_assignments, done_assignments, in_progress_assignments, current_job_status;

    -- Update job status based on assignment statuses
    IF total_assignments > 0 AND done_assignments = total_assignments THEN
        -- All assignments are done
        RAISE NOTICE 'Setting job % to done', target_job_id;
        UPDATE jobs SET status = 'done' WHERE id = target_job_id;
    ELSIF in_progress_assignments > 0 THEN
        -- At least one assignment is in progress
        RAISE NOTICE 'Setting job % to in_progress', target_job_id;
        UPDATE jobs SET status = 'in_progress' WHERE id = target_job_id;
    ELSIF total_assignments > 0 THEN
        -- All assignments are assigned (not started yet)
        RAISE NOTICE 'Setting job % to upcoming', target_job_id;
        UPDATE jobs SET status = 'upcoming' WHERE id = target_job_id;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
DROP TRIGGER IF EXISTS trigger_update_job_status ON job_assignments;
CREATE TRIGGER trigger_update_job_status
    AFTER INSERT OR UPDATE OR DELETE ON job_assignments
    FOR EACH ROW
    EXECUTE FUNCTION update_job_status_from_assignments();

-- Fix the trigger function to run with elevated privileges
-- This allows the trigger to update the job status even when an employee updates their assignment

-- Drop the existing function
DROP FUNCTION IF EXISTS update_job_status_from_assignments() CASCADE;

-- Recreate with SECURITY DEFINER so it runs with the permissions of the function owner
CREATE OR REPLACE FUNCTION update_job_status_from_assignments()
RETURNS TRIGGER
SECURITY DEFINER  -- This makes the function run with elevated privileges
SET search_path = public
AS $$
DECLARE
    total_assignments INTEGER;
    done_assignments INTEGER;
    in_progress_assignments INTEGER;
BEGIN
    -- Count total assignments for this job
    SELECT COUNT(*) INTO total_assignments
    FROM job_assignments
    WHERE job_id = COALESCE(NEW.job_id, OLD.job_id)
    AND assignment_status != 'cancelled';

    -- Count done assignments
    SELECT COUNT(*) INTO done_assignments
    FROM job_assignments
    WHERE job_id = COALESCE(NEW.job_id, OLD.job_id)
    AND assignment_status = 'done';

    -- Count in-progress assignments
    SELECT COUNT(*) INTO in_progress_assignments
    FROM job_assignments
    WHERE job_id = COALESCE(NEW.job_id, OLD.job_id)
    AND assignment_status = 'in_progress';

    -- Update job status based on assignment statuses
    IF total_assignments > 0 AND done_assignments = total_assignments THEN
        -- All assignments are done
        UPDATE jobs SET status = 'done' WHERE id = COALESCE(NEW.job_id, OLD.job_id);
    ELSIF in_progress_assignments > 0 THEN
        -- At least one assignment is in progress
        UPDATE jobs SET status = 'in_progress' WHERE id = COALESCE(NEW.job_id, OLD.job_id);
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

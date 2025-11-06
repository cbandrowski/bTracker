-- Create jobs table
CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

    -- Job details
    title TEXT NOT NULL,
    summary TEXT,

    -- Service info
    service_address TEXT,
    service_address_line_2 TEXT,
    service_city TEXT,
    service_state TEXT,
    service_zipcode TEXT,
    service_country TEXT DEFAULT 'USA',

    -- Tasks
    tasks_to_complete TEXT,

    -- Status for Job Board columns
    -- upcoming = red, in_progress = yellow, done = green, cancelled = gray
    status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'in_progress', 'done', 'cancelled')),

    -- Planned date to be done (just date, no time)
    planned_end_date DATE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for company_id lookups
CREATE INDEX IF NOT EXISTS idx_jobs_company_id ON jobs(company_id);

-- Create index for customer_id lookups
CREATE INDEX IF NOT EXISTS idx_jobs_customer_id ON jobs(customer_id);

-- Create index for status filtering (Job Board columns)
CREATE INDEX IF NOT EXISTS idx_jobs_company_status ON jobs(company_id, status);

-- Create composite index for efficient queries
CREATE INDEX IF NOT EXISTS idx_jobs_company_id_created_at ON jobs(company_id, created_at DESC);

-- Create job_assignments table
CREATE TABLE IF NOT EXISTS job_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES company_employees(id) ON DELETE CASCADE,

    -- Service dates/times (actual scheduled service time)
    service_start_at TIMESTAMPTZ,
    service_end_at TIMESTAMPTZ,

    -- Assignment status (for Assignments tab sections)
    -- assigned = scheduled but not started
    -- in_progress = worker is currently working
    -- done = worker marked complete
    -- cancelled = assignment cancelled
    assignment_status TEXT NOT NULL DEFAULT 'assigned' CHECK (assignment_status IN ('assigned', 'in_progress', 'done', 'cancelled')),

    -- Confirmation tracking
    worker_confirmed_done_at TIMESTAMPTZ,

    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for company_id lookups
CREATE INDEX IF NOT EXISTS idx_job_assignments_company_id ON job_assignments(company_id);

-- Create index for job_id lookups (to find all workers on a job)
CREATE INDEX IF NOT EXISTS idx_job_assignments_job_id ON job_assignments(job_id);

-- Create index for employee_id lookups (to find all jobs for an employee)
CREATE INDEX IF NOT EXISTS idx_job_assignments_employee_id ON job_assignments(employee_id);

-- Create index for assignment_status filtering (Assignments tab sections)
CREATE INDEX IF NOT EXISTS idx_job_assignments_status ON job_assignments(company_id, assignment_status);

-- Create index for service dates (Schedule tab)
CREATE INDEX IF NOT EXISTS idx_job_assignments_service_dates ON job_assignments(company_id, service_start_at, service_end_at);

-- Enable Row Level Security (RLS)
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for jobs table
-- Allow company owners to manage their jobs
CREATE POLICY "Company owners can view their jobs"
    ON jobs FOR SELECT
    USING (
        company_id IN (
            SELECT company_id FROM company_owners WHERE profile_id = auth.uid()
        )
    );

CREATE POLICY "Company owners can insert their jobs"
    ON jobs FOR INSERT
    WITH CHECK (
        company_id IN (
            SELECT company_id FROM company_owners WHERE profile_id = auth.uid()
        )
    );

CREATE POLICY "Company owners can update their jobs"
    ON jobs FOR UPDATE
    USING (
        company_id IN (
            SELECT company_id FROM company_owners WHERE profile_id = auth.uid()
        )
    );

CREATE POLICY "Company owners can delete their jobs"
    ON jobs FOR DELETE
    USING (
        company_id IN (
            SELECT company_id FROM company_owners WHERE profile_id = auth.uid()
        )
    );

-- Allow employees to view jobs they're assigned to
CREATE POLICY "Employees can view their assigned jobs"
    ON jobs FOR SELECT
    USING (
        id IN (
            SELECT job_id FROM job_assignments
            WHERE employee_id IN (
                SELECT id FROM company_employees WHERE profile_id = auth.uid()
            )
        )
    );

-- RLS Policies for job_assignments table
-- Allow company owners to manage job assignments
CREATE POLICY "Company owners can view job assignments"
    ON job_assignments FOR SELECT
    USING (
        company_id IN (
            SELECT company_id FROM company_owners WHERE profile_id = auth.uid()
        )
    );

CREATE POLICY "Company owners can insert job assignments"
    ON job_assignments FOR INSERT
    WITH CHECK (
        company_id IN (
            SELECT company_id FROM company_owners WHERE profile_id = auth.uid()
        )
    );

CREATE POLICY "Company owners can update job assignments"
    ON job_assignments FOR UPDATE
    USING (
        company_id IN (
            SELECT company_id FROM company_owners WHERE profile_id = auth.uid()
        )
    );

CREATE POLICY "Company owners can delete job assignments"
    ON job_assignments FOR DELETE
    USING (
        company_id IN (
            SELECT company_id FROM company_owners WHERE profile_id = auth.uid()
        )
    );

-- Allow employees to view their own assignments
CREATE POLICY "Employees can view their assignments"
    ON job_assignments FOR SELECT
    USING (
        employee_id IN (
            SELECT id FROM company_employees WHERE profile_id = auth.uid()
        )
    );

-- Allow employees to update their assignment status and confirm done
CREATE POLICY "Employees can update their assignment status"
    ON job_assignments FOR UPDATE
    USING (
        employee_id IN (
            SELECT id FROM company_employees WHERE profile_id = auth.uid()
        )
    )
    WITH CHECK (
        employee_id IN (
            SELECT id FROM company_employees WHERE profile_id = auth.uid()
        )
    );

-- Triggers for updated_at
CREATE TRIGGER update_jobs_updated_at
    BEFORE UPDATE ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_job_assignments_updated_at
    BEFORE UPDATE ON job_assignments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to auto-update job status based on assignments
CREATE OR REPLACE FUNCTION update_job_status_from_assignments()
RETURNS TRIGGER AS $$
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

-- Trigger to auto-update job status when assignments change
CREATE TRIGGER trigger_update_job_status
    AFTER INSERT OR UPDATE OR DELETE ON job_assignments
    FOR EACH ROW
    EXECUTE FUNCTION update_job_status_from_assignments();

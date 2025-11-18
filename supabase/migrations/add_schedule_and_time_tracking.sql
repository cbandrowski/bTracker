-- =====================================================
-- SCHEDULE & TIME TRACKING SYSTEM
-- =====================================================
-- This migration adds employee scheduling and time entry tracking
-- WITHOUT payroll fields (those will be added later)

-- =====================================================
-- 1. CREATE ENUMS
-- =====================================================

-- Schedule status enum
CREATE TYPE schedule_status AS ENUM (
  'scheduled',
  'cancelled',
  'completed'
);

-- Time entry status enum
CREATE TYPE time_entry_status AS ENUM (
  'pending_clock_in',      -- Employee clocked in, waiting for clock out
  'pending_approval',      -- Clocked out, needs owner approval
  'approved',              -- Owner approved
  'rejected'               -- Owner rejected
);

-- =====================================================
-- 2. CREATE TABLES
-- =====================================================

-- Employee Schedules (PLANNED shifts)
CREATE TABLE IF NOT EXISTS employee_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES company_employees(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,

  -- Time fields
  start_planned TIMESTAMPTZ NOT NULL,
  end_planned TIMESTAMPTZ NOT NULL,

  -- Status and notes
  status schedule_status NOT NULL DEFAULT 'scheduled',
  notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_schedule_times CHECK (end_planned > start_planned)
);

-- Time Entries (ACTUAL clock in/out)
CREATE TABLE IF NOT EXISTS time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES company_employees(id) ON DELETE CASCADE,
  schedule_id UUID REFERENCES employee_schedules(id) ON DELETE SET NULL,

  -- Employee-reported times
  clock_in_reported_at TIMESTAMPTZ NOT NULL,
  clock_out_reported_at TIMESTAMPTZ,

  -- Owner-approved times (may differ from reported)
  clock_in_approved_at TIMESTAMPTZ,
  clock_out_approved_at TIMESTAMPTZ,

  -- Status workflow
  status time_entry_status NOT NULL DEFAULT 'pending_clock_in',

  -- Approval tracking
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,

  -- Edit tracking
  edit_reason TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_reported_times CHECK (
    clock_out_reported_at IS NULL OR
    clock_out_reported_at > clock_in_reported_at
  ),
  CONSTRAINT valid_approved_times CHECK (
    clock_out_approved_at IS NULL OR
    clock_in_approved_at IS NULL OR
    clock_out_approved_at > clock_in_approved_at
  ),
  CONSTRAINT approved_requires_approver CHECK (
    (status != 'approved' AND status != 'rejected') OR
    (approved_by IS NOT NULL AND approved_at IS NOT NULL)
  )
);

-- =====================================================
-- 3. CREATE INDEXES
-- =====================================================

-- employee_schedules indexes
CREATE INDEX idx_employee_schedules_company ON employee_schedules(company_id);
CREATE INDEX idx_employee_schedules_employee ON employee_schedules(employee_id);
CREATE INDEX idx_employee_schedules_job ON employee_schedules(job_id) WHERE job_id IS NOT NULL;
CREATE INDEX idx_employee_schedules_status ON employee_schedules(status);
CREATE INDEX idx_employee_schedules_date_range ON employee_schedules(company_id, start_planned, end_planned);
CREATE INDEX idx_employee_schedules_employee_date ON employee_schedules(employee_id, start_planned);

-- time_entries indexes
CREATE INDEX idx_time_entries_company ON time_entries(company_id);
CREATE INDEX idx_time_entries_employee ON time_entries(employee_id);
CREATE INDEX idx_time_entries_schedule ON time_entries(schedule_id) WHERE schedule_id IS NOT NULL;
CREATE INDEX idx_time_entries_status ON time_entries(status);
CREATE INDEX idx_time_entries_pending ON time_entries(company_id, status)
  WHERE status IN ('pending_approval', 'pending_clock_in');
CREATE INDEX idx_time_entries_date_range ON time_entries(company_id, clock_in_reported_at);
CREATE INDEX idx_time_entries_employee_date ON time_entries(employee_id, clock_in_reported_at);
CREATE INDEX idx_time_entries_approved_by ON time_entries(approved_by) WHERE approved_by IS NOT NULL;

-- =====================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS
ALTER TABLE employee_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

-- employee_schedules policies

-- Owners can do everything with their company's schedules
CREATE POLICY "Owners can view their company schedules"
ON employee_schedules
FOR SELECT
USING (
  company_id IN (
    SELECT company_id
    FROM company_owners
    WHERE profile_id = auth.uid()
  )
);

CREATE POLICY "Owners can insert their company schedules"
ON employee_schedules
FOR INSERT
WITH CHECK (
  company_id IN (
    SELECT company_id
    FROM company_owners
    WHERE profile_id = auth.uid()
  )
);

CREATE POLICY "Owners can update their company schedules"
ON employee_schedules
FOR UPDATE
USING (
  company_id IN (
    SELECT company_id
    FROM company_owners
    WHERE profile_id = auth.uid()
  )
);

CREATE POLICY "Owners can delete their company schedules"
ON employee_schedules
FOR DELETE
USING (
  company_id IN (
    SELECT company_id
    FROM company_owners
    WHERE profile_id = auth.uid()
  )
);

-- Employees can view their own schedules
CREATE POLICY "Employees can view their own schedules"
ON employee_schedules
FOR SELECT
USING (
  employee_id IN (
    SELECT id
    FROM company_employees
    WHERE profile_id = auth.uid()
  )
);

-- time_entries policies

-- Owners can view their company's time entries
CREATE POLICY "Owners can view their company time entries"
ON time_entries
FOR SELECT
USING (
  company_id IN (
    SELECT company_id
    FROM company_owners
    WHERE profile_id = auth.uid()
  )
);

-- Owners can update their company's time entries (for approvals)
CREATE POLICY "Owners can update their company time entries"
ON time_entries
FOR UPDATE
USING (
  company_id IN (
    SELECT company_id
    FROM company_owners
    WHERE profile_id = auth.uid()
  )
);

-- Employees can view their own time entries
CREATE POLICY "Employees can view their own time entries"
ON time_entries
FOR SELECT
USING (
  employee_id IN (
    SELECT id
    FROM company_employees
    WHERE profile_id = auth.uid()
  )
);

-- Employees can insert their own time entries (clock in)
CREATE POLICY "Employees can insert their own time entries"
ON time_entries
FOR INSERT
WITH CHECK (
  employee_id IN (
    SELECT id
    FROM company_employees
    WHERE profile_id = auth.uid()
  )
);

-- Employees can update their own pending time entries (clock out)
CREATE POLICY "Employees can update their own pending time entries"
ON time_entries
FOR UPDATE
USING (
  employee_id IN (
    SELECT id
    FROM company_employees
    WHERE profile_id = auth.uid()
  )
  AND status = 'pending_clock_in'
);

-- =====================================================
-- 5. TRIGGERS FOR UPDATED_AT
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_employee_schedules_updated_at
  BEFORE UPDATE ON employee_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_time_entries_updated_at
  BEFORE UPDATE ON time_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 6. HELPFUL VIEWS (OPTIONAL)
-- =====================================================

-- View for pending time entries with employee details
CREATE OR REPLACE VIEW v_pending_time_entries AS
SELECT
  te.*,
  ce.profile_id,
  p.full_name as employee_name,
  p.email as employee_email,
  es.start_planned,
  es.end_planned,
  j.title as job_title,
  c.name as customer_name
FROM time_entries te
JOIN company_employees ce ON te.employee_id = ce.id
JOIN profiles p ON ce.profile_id = p.id
LEFT JOIN employee_schedules es ON te.schedule_id = es.id
LEFT JOIN jobs j ON es.job_id = j.id
LEFT JOIN customers c ON j.customer_id = c.id
WHERE te.status IN ('pending_approval', 'pending_clock_in');

-- View for schedules with employee details
CREATE OR REPLACE VIEW v_employee_schedules AS
SELECT
  es.*,
  ce.profile_id,
  p.full_name as employee_name,
  p.email as employee_email,
  j.title as job_title,
  c.name as customer_name
FROM employee_schedules es
JOIN company_employees ce ON es.employee_id = ce.id
JOIN profiles p ON ce.profile_id = p.id
LEFT JOIN jobs j ON es.job_id = j.id
LEFT JOIN customers c ON j.customer_id = c.id;

-- =====================================================
-- 7. COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE employee_schedules IS 'Planned work schedules for employees';
COMMENT ON TABLE time_entries IS 'Actual time clock-in/out entries with approval workflow';

COMMENT ON COLUMN time_entries.clock_in_reported_at IS 'When employee says they clocked in';
COMMENT ON COLUMN time_entries.clock_out_reported_at IS 'When employee says they clocked out';
COMMENT ON COLUMN time_entries.clock_in_approved_at IS 'Owner-approved clock in time (may differ from reported)';
COMMENT ON COLUMN time_entries.clock_out_approved_at IS 'Owner-approved clock out time (may differ from reported)';
COMMENT ON COLUMN time_entries.edit_reason IS 'Reason for time adjustment by owner';

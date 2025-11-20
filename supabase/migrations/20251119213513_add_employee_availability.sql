-- Create table to track each employee's weekly availability (one row per day)
CREATE TABLE public.employee_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  company_employee_id uuid NOT NULL REFERENCES public.company_employees(id),
  day_of_week smallint NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  is_available boolean NOT NULL DEFAULT false,
  start_time time without time zone,
  end_time time without time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT employee_availability_unique_day UNIQUE (company_employee_id, day_of_week),
  CONSTRAINT employee_availability_time_valid CHECK (
    (is_available = false AND start_time IS NULL AND end_time IS NULL)
    OR (is_available = true AND start_time IS NOT NULL AND end_time IS NOT NULL AND start_time < end_time)
  )
);

CREATE INDEX employee_availability_company_idx ON public.employee_availability (company_id);
CREATE INDEX employee_availability_employee_idx ON public.employee_availability (company_employee_id);

-- Enable RLS
ALTER TABLE public.employee_availability ENABLE ROW LEVEL SECURITY;

-- RLS Policies for employee_availability

-- Employees can read their own availability
CREATE POLICY "Employees can read their own availability"
  ON public.employee_availability
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.company_employees ce
      WHERE ce.id = employee_availability.company_employee_id
        AND ce.profile_id = auth.uid()
    )
  );

-- Employees can insert their own availability
CREATE POLICY "Employees can insert their own availability"
  ON public.employee_availability
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_employees ce
      WHERE ce.id = employee_availability.company_employee_id
        AND ce.profile_id = auth.uid()
    )
  );

-- Employees can update their own availability
CREATE POLICY "Employees can update their own availability"
  ON public.employee_availability
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.company_employees ce
      WHERE ce.id = employee_availability.company_employee_id
        AND ce.profile_id = auth.uid()
    )
  );

-- Employees can delete their own availability
CREATE POLICY "Employees can delete their own availability"
  ON public.employee_availability
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.company_employees ce
      WHERE ce.id = employee_availability.company_employee_id
        AND ce.profile_id = auth.uid()
    )
  );

-- Owners can read all availability in their company
CREATE POLICY "Owners can read company employee availability"
  ON public.employee_availability
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.company_owners co
      WHERE co.company_id = employee_availability.company_id
        AND co.profile_id = auth.uid()
    )
  );

-- Owners can manage availability for their company employees
CREATE POLICY "Owners can manage company employee availability"
  ON public.employee_availability
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.company_owners co
      WHERE co.company_id = employee_availability.company_id
        AND co.profile_id = auth.uid()
    )
  );

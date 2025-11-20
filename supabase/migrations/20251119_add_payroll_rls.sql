-- Enable Row Level Security on payroll tables
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_run_lines ENABLE ROW LEVEL SECURITY;

-- Payroll Runs Policies

-- Owners can view all payroll runs for their companies
CREATE POLICY "Owners can view payroll runs for their companies"
  ON public.payroll_runs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.company_owners co
      WHERE co.company_id = payroll_runs.company_id
        AND co.profile_id = auth.uid()
    )
  );

-- Owners can create payroll runs for their companies
CREATE POLICY "Owners can create payroll runs for their companies"
  ON public.payroll_runs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_owners co
      WHERE co.company_id = payroll_runs.company_id
        AND co.profile_id = auth.uid()
    )
  );

-- Owners can update payroll runs for their companies
CREATE POLICY "Owners can update payroll runs for their companies"
  ON public.payroll_runs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.company_owners co
      WHERE co.company_id = payroll_runs.company_id
        AND co.profile_id = auth.uid()
    )
  );

-- Owners can delete payroll runs for their companies
CREATE POLICY "Owners can delete payroll runs for their companies"
  ON public.payroll_runs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.company_owners co
      WHERE co.company_id = payroll_runs.company_id
        AND co.profile_id = auth.uid()
    )
  );

-- Payroll Run Lines Policies

-- Owners can view all payroll run lines for their company's payroll runs
CREATE POLICY "Owners can view payroll run lines for their companies"
  ON public.payroll_run_lines
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.payroll_runs pr
      JOIN public.company_owners co ON co.company_id = pr.company_id
      WHERE pr.id = payroll_run_lines.payroll_run_id
        AND co.profile_id = auth.uid()
    )
  );

-- Employees can view their own payroll run lines
CREATE POLICY "Employees can view their own payroll run lines"
  ON public.payroll_run_lines
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.company_employees ce
      WHERE ce.id = payroll_run_lines.employee_id
        AND ce.profile_id = auth.uid()
    )
  );

-- Owners can insert payroll run lines for their company's payroll runs
CREATE POLICY "Owners can insert payroll run lines for their companies"
  ON public.payroll_run_lines
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.payroll_runs pr
      JOIN public.company_owners co ON co.company_id = pr.company_id
      WHERE pr.id = payroll_run_lines.payroll_run_id
        AND co.profile_id = auth.uid()
    )
  );

-- Owners can update payroll run lines for their company's payroll runs
CREATE POLICY "Owners can update payroll run lines for their companies"
  ON public.payroll_run_lines
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.payroll_runs pr
      JOIN public.company_owners co ON co.company_id = pr.company_id
      WHERE pr.id = payroll_run_lines.payroll_run_id
        AND co.profile_id = auth.uid()
    )
  );

-- Owners can delete payroll run lines for their company's payroll runs
CREATE POLICY "Owners can delete payroll run lines for their companies"
  ON public.payroll_run_lines
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.payroll_runs pr
      JOIN public.company_owners co ON co.company_id = pr.company_id
      WHERE pr.id = payroll_run_lines.payroll_run_id
        AND co.profile_id = auth.uid()
    )
  );

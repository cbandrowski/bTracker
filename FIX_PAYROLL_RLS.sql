-- FIX PAYROLL RLS POLICIES
-- This SQL script adds Row Level Security to payroll tables so employees can view their own payroll data
--
-- TO APPLY: Copy this entire file and paste it into your Supabase SQL Editor
-- Dashboard: https://chrdcugzkuidvcfydsub.supabase.co/project/_/sql

-- Enable Row Level Security on payroll tables
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_run_lines ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (to avoid conflicts)
DROP POLICY IF EXISTS "Owners can view payroll runs for their companies" ON public.payroll_runs;
DROP POLICY IF EXISTS "Owners can create payroll runs for their companies" ON public.payroll_runs;
DROP POLICY IF EXISTS "Owners can update payroll runs for their companies" ON public.payroll_runs;
DROP POLICY IF EXISTS "Owners can delete payroll runs for their companies" ON public.payroll_runs;
DROP POLICY IF EXISTS "Owners can view payroll run lines for their companies" ON public.payroll_run_lines;
DROP POLICY IF EXISTS "Employees can view their own payroll run lines" ON public.payroll_run_lines;
DROP POLICY IF EXISTS "Owners can insert payroll run lines for their companies" ON public.payroll_run_lines;
DROP POLICY IF EXISTS "Owners can update payroll run lines for their companies" ON public.payroll_run_lines;
DROP POLICY IF EXISTS "Owners can delete payroll run lines for their companies" ON public.payroll_run_lines;

-- PAYROLL RUNS POLICIES

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

-- PAYROLL RUN LINES POLICIES

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

-- ⭐ THIS IS THE KEY POLICY FOR EMPLOYEES ⭐
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

-- Verify the policies were created
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename IN ('payroll_runs', 'payroll_run_lines')
ORDER BY tablename, policyname;

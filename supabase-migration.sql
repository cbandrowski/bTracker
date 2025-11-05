-- ==========================================
-- CLEAN MIGRATION: Drop and Recreate Everything
-- ==========================================

-- Drop existing tables if they exist
DROP TABLE IF EXISTS public.company_employees CASCADE;
DROP TABLE IF EXISTS public.company_owners CASCADE;
DROP TABLE IF EXISTS public.companies CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TYPE IF EXISTS employment_status CASCADE;

-- ==========================================
-- CREATE TABLES
-- ==========================================

-- Profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text,
  email text,
  address text,
  address_line_2 text,
  city text,
  state text,
  zipcode text,
  country text DEFAULT 'USA',
  avatar_url text,
  timezone text DEFAULT 'America/New_York',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Companies table
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  address_line_2 text,
  city text,
  state text,
  zipcode text,
  country text DEFAULT 'USA',
  company_code text NOT NULL UNIQUE,
  phone text,
  email text,
  website text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Employment status enum
CREATE TYPE employment_status AS ENUM ('active', 'terminated', 'on_leave');

-- Company owners table (many-to-many)
CREATE TABLE public.company_owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ownership_percentage numeric(5,2),
  is_primary_owner boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (company_id, profile_id)
);

-- Ensure only one primary owner per company
CREATE UNIQUE INDEX company_owners_primary_per_company_idx
  ON public.company_owners (company_id)
  WHERE is_primary_owner = true;

-- Company employees table (many-to-many)
CREATE TABLE public.company_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  hire_date date NOT NULL,
  termination_date date,
  job_title text,
  department text,
  employment_status employment_status NOT NULL DEFAULT 'active',
  is_manager boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (company_id, profile_id)
);

-- ==========================================
-- CREATE INDEXES
-- ==========================================

CREATE INDEX idx_company_employees_company_id ON public.company_employees (company_id);
CREATE INDEX idx_company_employees_profile_id ON public.company_employees (profile_id);
CREATE INDEX idx_company_owners_company_id ON public.company_owners (company_id);
CREATE INDEX idx_company_owners_profile_id ON public.company_owners (profile_id);

-- ==========================================
-- GRANT PERMISSIONS
-- ==========================================

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.companies TO authenticated;
GRANT ALL ON public.company_owners TO authenticated;
GRANT ALL ON public.company_employees TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ==========================================
-- ENABLE RLS
-- ==========================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_employees ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- RLS POLICIES: PROFILES
-- ==========================================

-- Users can query profiles table for their own ID (even if no row exists yet)
-- This allows checking if profile exists during onboarding
CREATE POLICY "profiles_select_own"
ON public.profiles
FOR SELECT
USING (id = auth.uid());

-- Users can insert their own profile
CREATE POLICY "profiles_insert_own"
ON public.profiles
FOR INSERT
WITH CHECK (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "profiles_update_own"
ON public.profiles
FOR UPDATE
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- ==========================================
-- RLS POLICIES: COMPANIES
-- ==========================================

-- Users can see companies they own or work for
CREATE POLICY "companies_select_related"
ON public.companies
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.company_owners co
    WHERE co.company_id = companies.id AND co.profile_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.company_employees ce
    WHERE ce.company_id = companies.id AND ce.profile_id = auth.uid()
  )
);

-- Any authenticated user can create a company
CREATE POLICY "companies_insert_authenticated"
ON public.companies
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Only owners can update their companies
CREATE POLICY "companies_update_owners_only"
ON public.companies
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.company_owners co
    WHERE co.company_id = companies.id AND co.profile_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.company_owners co
    WHERE co.company_id = companies.id AND co.profile_id = auth.uid()
  )
);

-- ==========================================
-- RLS POLICIES: COMPANY_OWNERS
-- ==========================================

-- Owners can see all owners for their companies
CREATE POLICY "company_owners_select_for_owners"
ON public.company_owners
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.company_owners co_me
    WHERE co_me.company_id = company_owners.company_id
    AND co_me.profile_id = auth.uid()
  )
);

-- Owners can add other owners
CREATE POLICY "company_owners_insert_by_owner"
ON public.company_owners
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.company_owners co_me
    WHERE co_me.company_id = company_owners.company_id
    AND co_me.profile_id = auth.uid()
  )
  OR
  -- Allow first owner to be added (when no owners exist yet)
  NOT EXISTS (
    SELECT 1 FROM public.company_owners co_existing
    WHERE co_existing.company_id = company_owners.company_id
  )
);

-- Owners can update ownership records
CREATE POLICY "company_owners_update_by_owner"
ON public.company_owners
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.company_owners co_me
    WHERE co_me.company_id = company_owners.company_id
    AND co_me.profile_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.company_owners co_me
    WHERE co_me.company_id = company_owners.company_id
    AND co_me.profile_id = auth.uid()
  )
);

-- Owners can delete ownership records
CREATE POLICY "company_owners_delete_by_owner"
ON public.company_owners
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.company_owners co_me
    WHERE co_me.company_id = company_owners.company_id
    AND co_me.profile_id = auth.uid()
  )
);

-- ==========================================
-- RLS POLICIES: COMPANY_EMPLOYEES
-- ==========================================

-- Employees can see their own records, owners can see all employees
CREATE POLICY "company_employees_select_employee_or_owner"
ON public.company_employees
FOR SELECT
USING (
  profile_id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM public.company_owners co
    WHERE co.company_id = company_employees.company_id
    AND co.profile_id = auth.uid()
  )
);

-- Owners can add employees
CREATE POLICY "company_employees_insert_by_owner"
ON public.company_employees
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.company_owners co
    WHERE co.company_id = company_employees.company_id
    AND co.profile_id = auth.uid()
  )
  OR
  -- Allow self-joining a company
  profile_id = auth.uid()
);

-- Owners can update employee records
CREATE POLICY "company_employees_update_by_owner"
ON public.company_employees
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.company_owners co
    WHERE co.company_id = company_employees.company_id
    AND co.profile_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.company_owners co
    WHERE co.company_id = company_employees.company_id
    AND co.profile_id = auth.uid()
  )
);

-- Owners can delete employee records
CREATE POLICY "company_employees_delete_by_owner"
ON public.company_employees
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.company_owners co
    WHERE co.company_id = company_employees.company_id
    AND co.profile_id = auth.uid()
  )
);

-- ==========================================
-- DONE
-- ==========================================

SELECT 'Migration completed successfully!' as status;

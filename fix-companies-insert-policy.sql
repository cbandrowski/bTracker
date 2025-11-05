-- ==========================================
-- FIX: Companies & Company_Owners INSERT Policies
-- ==========================================
-- This script fixes the 403 error when creating companies
-- by ensuring correct INSERT policies for both tables

BEGIN;

-- First, let's see what we're working with
SELECT 'BEFORE: Companies policies' as status;
SELECT policyname, cmd, with_check
FROM pg_policies
WHERE tablename = 'companies';

-- ==========================================
-- STEP 1: Fix Companies Table INSERT Policy
-- ==========================================

-- Drop ALL existing policies on companies table (we'll recreate what we need)
DROP POLICY IF EXISTS "companies_insert_authenticated" ON public.companies;
DROP POLICY IF EXISTS "companies_insert_any_authenticated" ON public.companies;
DROP POLICY IF EXISTS "companies_insert" ON public.companies;
DROP POLICY IF EXISTS "companies_all" ON public.companies;

-- Create a single, clean INSERT policy
-- This allows ANY authenticated user to create a company
CREATE POLICY "companies_insert_authenticated"
ON public.companies
FOR INSERT
TO authenticated
WITH CHECK (true);

-- ==========================================
-- STEP 2: Fix Company_Owners Table INSERT Policy
-- ==========================================

-- Drop existing policies
DROP POLICY IF EXISTS "company_owners_insert_by_owner" ON public.company_owners;
DROP POLICY IF EXISTS "company_owners_insert" ON public.company_owners;

-- Recreate the policy that allows:
-- 1. Owners to add other owners
-- 2. First owner to be added (when no owners exist yet for that company)
CREATE POLICY "company_owners_insert_by_owner"
ON public.company_owners
FOR INSERT
TO authenticated
WITH CHECK (
  -- Allow if user is already an owner of this company
  EXISTS (
    SELECT 1 FROM public.company_owners co_me
    WHERE co_me.company_id = company_owners.company_id
    AND co_me.profile_id = auth.uid()
  )
  OR
  -- Allow first owner to be added (when no owners exist yet for this company)
  NOT EXISTS (
    SELECT 1 FROM public.company_owners co_existing
    WHERE co_existing.company_id = company_owners.company_id
  )
);

-- ==========================================
-- STEP 3: Verify Policies Were Created
-- ==========================================

-- Check companies INSERT policy
SELECT
  'companies' as table_name,
  policyname,
  roles,
  cmd,
  with_check
FROM pg_policies
WHERE tablename = 'companies' AND cmd = 'INSERT';

-- Check company_owners INSERT policy
SELECT
  'company_owners' as table_name,
  policyname,
  roles,
  cmd,
  with_check
FROM pg_policies
WHERE tablename = 'company_owners' AND cmd = 'INSERT';

COMMIT;

-- ==========================================
-- Expected Output:
--
-- For companies table:
--   - policyname: companies_insert_authenticated
--   - roles: {authenticated}
--   - cmd: INSERT
--   - with_check: true
--
-- For company_owners table:
--   - policyname: company_owners_insert_by_owner
--   - roles: {authenticated}
--   - cmd: INSERT
--   - with_check: (complex condition shown)
-- ==========================================

-- ==========================================
-- SIMPLE FIX: Remove ALL policies and recreate properly
-- ==========================================

BEGIN;

-- STEP 1: Drop EVERYTHING on companies table
DROP POLICY IF EXISTS "companies_insert_any_authenticated" ON public.companies;
DROP POLICY IF EXISTS "companies_insert_authenticated" ON public.companies;
DROP POLICY IF EXISTS "companies_select_related" ON public.companies;
DROP POLICY IF EXISTS "companies_update_owners_only" ON public.companies;
-- Drop any policy with command 'a' (ALL)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'companies') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.companies', r.policyname);
    END LOOP;
END$$;

-- STEP 2: Recreate policies with specific commands (not 'a'/ALL)

-- INSERT: Any authenticated user can create a company
CREATE POLICY "companies_insert"
ON public.companies
FOR INSERT
TO authenticated
WITH CHECK (true);

-- SELECT: Users can see companies they own or work for
CREATE POLICY "companies_select"
ON public.companies
FOR SELECT
TO authenticated
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

-- UPDATE: Only owners can update
CREATE POLICY "companies_update"
ON public.companies
FOR UPDATE
TO authenticated
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

-- STEP 3: Fix company_owners table
DROP POLICY IF EXISTS "company_owners_insert_by_owner" ON public.company_owners;
DROP POLICY IF EXISTS "company_owners_select_for_owners" ON public.company_owners;

-- INSERT: Allow first owner, or existing owners
CREATE POLICY "company_owners_insert"
ON public.company_owners
FOR INSERT
TO authenticated
WITH CHECK (
  -- Allow if no owners exist yet for this company (first owner)
  NOT EXISTS (
    SELECT 1 FROM public.company_owners co
    WHERE co.company_id = company_owners.company_id
  )
  OR
  -- Allow if user is already an owner
  EXISTS (
    SELECT 1 FROM public.company_owners co
    WHERE co.company_id = company_owners.company_id
    AND co.profile_id = auth.uid()
  )
);

-- SELECT: Owners can see all owners
CREATE POLICY "company_owners_select"
ON public.company_owners
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.company_owners co
    WHERE co.company_id = company_owners.company_id
    AND co.profile_id = auth.uid()
  )
);

-- STEP 4: Verify
SELECT 'Policies created:' as status;
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('companies', 'company_owners')
ORDER BY tablename, cmd;

COMMIT;

SELECT '✅ Done! Try creating a company now.' as message;

-- ==========================================
-- DIAGNOSE: Check ALL RLS Policies
-- ==========================================
-- This shows all policies for companies and company_owners tables

-- Check all policies on companies table
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_expr,
  with_check as check_expr
FROM pg_policies
WHERE tablename IN ('companies', 'company_owners')
ORDER BY tablename, cmd, policyname;

-- Also check if RLS is enabled
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename IN ('companies', 'company_owners', 'profiles', 'company_employees')
ORDER BY tablename;

-- Check what role is being used
SELECT current_user, session_user;

-- Test if auth.uid() is available
SELECT auth.uid() as current_auth_uid;

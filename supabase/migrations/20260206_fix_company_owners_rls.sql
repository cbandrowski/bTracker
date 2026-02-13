-- Fix company_owners RLS recursion by using security definer helpers

CREATE OR REPLACE FUNCTION public.is_company_owner(p_company_id uuid)
RETURNS boolean
LANGUAGE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_owners
    WHERE company_id = p_company_id
      AND profile_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.company_has_owner(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_owners
    WHERE company_id = p_company_id
  );
$$;

DROP POLICY IF EXISTS "Owners can view company owners" ON public.company_owners;
DROP POLICY IF EXISTS "Owners can insert initial owner" ON public.company_owners;
DROP POLICY IF EXISTS "Owners can insert approved owner additions" ON public.company_owners;
DROP POLICY IF EXISTS "Owners can delete approved owner removals" ON public.company_owners;

CREATE POLICY "Owners can view company owners"
  ON public.company_owners
  FOR SELECT
  USING (
    profile_id = auth.uid()
    OR public.is_company_owner(company_id)
  );

CREATE POLICY "Owners can insert initial owner"
  ON public.company_owners
  FOR INSERT
  WITH CHECK (
    profile_id = auth.uid()
    AND NOT public.company_has_owner(company_id)
  );

CREATE POLICY "Owners can insert approved owner additions"
  ON public.company_owners
  FOR INSERT
  WITH CHECK (
    public.is_company_owner(company_id)
    AND EXISTS (
      SELECT 1 FROM public.owner_change_requests req
      WHERE req.company_id = company_owners.company_id
        AND req.action = 'add_owner'
        AND req.target_profile_id = company_owners.profile_id
        AND req.status = 'approved'
    )
  );

CREATE POLICY "Owners can delete approved owner removals"
  ON public.company_owners
  FOR DELETE
  USING (
    public.is_company_owner(company_id)
    AND EXISTS (
      SELECT 1 FROM public.owner_change_requests req
      WHERE req.company_id = company_owners.company_id
        AND req.action = 'remove_owner'
        AND req.target_profile_id = company_owners.profile_id
        AND req.status = 'approved'
        AND (req.effective_at IS NULL OR req.effective_at <= now())
    )
  );

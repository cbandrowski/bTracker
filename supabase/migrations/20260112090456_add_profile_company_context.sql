BEGIN;

CREATE TABLE IF NOT EXISTS public.profile_company_context (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  active_company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  active_role text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT profile_company_context_active_role_check
    CHECK (
      (active_company_id IS NULL AND active_role IS NULL)
      OR (active_company_id IS NOT NULL AND active_role IN ('owner', 'employee'))
    )
);

ALTER TABLE public.profile_company_context OWNER TO postgres;

ALTER TABLE public.profile_company_context ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their company context"
  ON public.profile_company_context
  TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

CREATE TRIGGER profile_company_context_updated_at
BEFORE UPDATE ON public.profile_company_context
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE VIEW public.company_memberships AS
SELECT
  co.company_id,
  co.profile_id,
  'owner'::text AS role,
  co.id AS owner_id,
  NULL::uuid AS employee_id,
  NULL::text AS approval_status,
  NULL::text AS work_status,
  co.is_primary_owner
FROM public.company_owners co
UNION ALL
SELECT
  ce.company_id,
  ce.profile_id,
  'employee'::text AS role,
  NULL::uuid AS owner_id,
  ce.id AS employee_id,
  ce.approval_status,
  ce.work_status,
  NULL::boolean AS is_primary_owner
FROM public.company_employees ce;

COMMENT ON TABLE public.profile_company_context IS 'Stores each user''s active company and role for multi-company navigation.';
COMMENT ON VIEW public.company_memberships IS 'Union view of owner and employee memberships per company.';

COMMIT;

-- Owner change workflow (add/remove owners with approvals)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'owner_change_action') THEN
    CREATE TYPE public.owner_change_action AS ENUM ('add_owner', 'remove_owner');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'owner_change_status') THEN
    CREATE TYPE public.owner_change_status AS ENUM (
      'pending',
      'approved',
      'rejected',
      'cancelled',
      'executed',
      'expired'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'owner_change_decision') THEN
    CREATE TYPE public.owner_change_decision AS ENUM ('approve', 'reject');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.owner_change_requests (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  action public.owner_change_action NOT NULL,
  target_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status public.owner_change_status NOT NULL DEFAULT 'pending',
  required_approvals integer NOT NULL DEFAULT 1,
  cooldown_hours integer NOT NULL DEFAULT 24,
  approved_at timestamp with time zone,
  effective_at timestamp with time zone,
  executed_at timestamp with time zone,
  rejected_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT owner_change_requests_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.owner_change_approvals (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  request_id uuid NOT NULL REFERENCES public.owner_change_requests(id) ON DELETE CASCADE,
  approver_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  decision public.owner_change_decision NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT owner_change_approvals_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS owner_change_requests_company_idx
  ON public.owner_change_requests(company_id);
CREATE INDEX IF NOT EXISTS owner_change_requests_status_idx
  ON public.owner_change_requests(company_id, status);
CREATE INDEX IF NOT EXISTS owner_change_requests_target_idx
  ON public.owner_change_requests(target_profile_id);
CREATE UNIQUE INDEX IF NOT EXISTS owner_change_requests_unique_pending
  ON public.owner_change_requests(company_id, action, target_profile_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS owner_change_approvals_request_idx
  ON public.owner_change_approvals(request_id);
CREATE UNIQUE INDEX IF NOT EXISTS owner_change_approvals_unique
  ON public.owner_change_approvals(request_id, approver_profile_id);

CREATE TRIGGER update_owner_change_requests_updated_at
  BEFORE UPDATE ON public.owner_change_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.owner_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_change_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view owner change requests"
  ON public.owner_change_requests
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.company_owners WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Owners can create owner change requests"
  ON public.owner_change_requests
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.company_owners WHERE profile_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

CREATE POLICY "Owners can update owner change requests"
  ON public.owner_change_requests
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.company_owners WHERE profile_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.company_owners WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Owners can view owner change approvals"
  ON public.owner_change_approvals
  FOR SELECT
  USING (
    request_id IN (
      SELECT id FROM public.owner_change_requests
      WHERE company_id IN (
        SELECT company_id FROM public.company_owners WHERE profile_id = auth.uid()
      )
    )
  );

CREATE POLICY "Owners can create owner change approvals"
  ON public.owner_change_approvals
  FOR INSERT
  WITH CHECK (
    approver_profile_id = auth.uid()
    AND request_id IN (
      SELECT id FROM public.owner_change_requests
      WHERE company_id IN (
        SELECT company_id FROM public.company_owners WHERE profile_id = auth.uid()
      )
    )
  );

-- Tighten company_owners policies to require approved owner changes
DROP POLICY IF EXISTS "company_owners_all_authenticated" ON public.company_owners;

CREATE POLICY "Owners can view company owners"
  ON public.company_owners
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.company_owners WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Owners can insert initial owner"
  ON public.company_owners
  FOR INSERT
  WITH CHECK (
    profile_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.company_owners existing
      WHERE existing.company_id = company_owners.company_id
    )
  );

CREATE POLICY "Owners can insert approved owner additions"
  ON public.company_owners
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.company_owners WHERE profile_id = auth.uid()
    )
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
    company_id IN (
      SELECT company_id FROM public.company_owners WHERE profile_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.owner_change_requests req
      WHERE req.company_id = company_owners.company_id
        AND req.action = 'remove_owner'
        AND req.target_profile_id = company_owners.profile_id
        AND req.status = 'approved'
        AND (req.effective_at IS NULL OR req.effective_at <= now())
    )
  );

GRANT SELECT, INSERT, UPDATE ON TABLE public.owner_change_requests TO authenticated;
GRANT SELECT, INSERT ON TABLE public.owner_change_approvals TO authenticated;
GRANT ALL ON TABLE public.owner_change_requests TO service_role;
GRANT ALL ON TABLE public.owner_change_approvals TO service_role;

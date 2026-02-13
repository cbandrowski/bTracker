-- Approval requests workflow for sensitive owner actions

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'approval_action') THEN
    CREATE TYPE public.approval_action AS ENUM (
      'employee_pay_change',
      'job_update',
      'invoice_update'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'approval_status') THEN
    CREATE TYPE public.approval_status AS ENUM (
      'pending',
      'approved',
      'rejected',
      'cancelled',
      'applied',
      'failed'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'approval_decision') THEN
    CREATE TYPE public.approval_decision AS ENUM ('approve', 'reject');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.approval_requests (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  action public.approval_action NOT NULL,
  entity_table text NOT NULL,
  entity_id uuid NOT NULL,
  entity_label text,
  summary text,
  payload jsonb NOT NULL,
  requested_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status public.approval_status NOT NULL DEFAULT 'pending',
  required_approvals integer NOT NULL DEFAULT 1,
  approved_at timestamp with time zone,
  rejected_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  applied_at timestamp with time zone,
  applied_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT approval_requests_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.approval_decisions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  approval_id uuid NOT NULL REFERENCES public.approval_requests(id) ON DELETE CASCADE,
  approver_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  decision public.approval_decision NOT NULL,
  note text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT approval_decisions_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS approval_requests_company_idx
  ON public.approval_requests(company_id);
CREATE INDEX IF NOT EXISTS approval_requests_status_idx
  ON public.approval_requests(company_id, status);
CREATE INDEX IF NOT EXISTS approval_requests_entity_idx
  ON public.approval_requests(entity_table, entity_id);
CREATE UNIQUE INDEX IF NOT EXISTS approval_requests_unique_pending
  ON public.approval_requests(company_id, action, entity_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS approval_decisions_request_idx
  ON public.approval_decisions(approval_id);
CREATE UNIQUE INDEX IF NOT EXISTS approval_decisions_unique
  ON public.approval_decisions(approval_id, approver_profile_id);

CREATE TRIGGER update_approval_requests_updated_at
  BEFORE UPDATE ON public.approval_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view approval requests"
  ON public.approval_requests
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.company_owners WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Owners can create approval requests"
  ON public.approval_requests
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.company_owners WHERE profile_id = auth.uid()
    )
    AND requested_by = auth.uid()
  );

CREATE POLICY "Owners can update approval requests"
  ON public.approval_requests
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

CREATE POLICY "Owners can view approval decisions"
  ON public.approval_decisions
  FOR SELECT
  USING (
    approval_id IN (
      SELECT id FROM public.approval_requests
      WHERE company_id IN (
        SELECT company_id FROM public.company_owners WHERE profile_id = auth.uid()
      )
    )
  );

CREATE POLICY "Owners can create approval decisions"
  ON public.approval_decisions
  FOR INSERT
  WITH CHECK (
    approver_profile_id = auth.uid()
    AND approval_id IN (
      SELECT id FROM public.approval_requests
      WHERE company_id IN (
        SELECT company_id FROM public.company_owners WHERE profile_id = auth.uid()
      )
    )
  );

GRANT SELECT, INSERT, UPDATE ON TABLE public.approval_requests TO authenticated;
GRANT SELECT, INSERT ON TABLE public.approval_decisions TO authenticated;
GRANT ALL ON TABLE public.approval_requests TO service_role;
GRANT ALL ON TABLE public.approval_decisions TO service_role;

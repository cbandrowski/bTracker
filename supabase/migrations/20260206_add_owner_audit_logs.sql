-- Owner audit logs with field-level diffs

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  actor_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_table text NOT NULL,
  entity_id uuid,
  before jsonb,
  after jsonb,
  diff jsonb,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS audit_logs_company_created_idx
  ON public.audit_logs(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_actor_idx
  ON public.audit_logs(actor_profile_id);
CREATE INDEX IF NOT EXISTS audit_logs_entity_idx
  ON public.audit_logs(entity_table, entity_id);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view audit logs"
  ON public.audit_logs
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.company_owners WHERE profile_id = auth.uid()
    )
  );

GRANT SELECT ON TABLE public.audit_logs TO authenticated;
GRANT ALL ON TABLE public.audit_logs TO service_role;

CREATE OR REPLACE FUNCTION public.audit_build_diff(before_row jsonb, after_row jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'field', key,
        'before', before_row -> key,
        'after', after_row -> key
      )
      ORDER BY key
    ),
    '[]'::jsonb
  )
  FROM (
    SELECT key FROM jsonb_object_keys(COALESCE(before_row, '{}'::jsonb)) AS key
    UNION
    SELECT key FROM jsonb_object_keys(COALESCE(after_row, '{}'::jsonb)) AS key
  ) keys
  WHERE key NOT IN ('updated_at', 'created_at')
    AND (before_row -> key) IS DISTINCT FROM (after_row -> key);
$$;

CREATE OR REPLACE FUNCTION public.audit_resolve_company_id(
  table_name text,
  new_row jsonb,
  old_row jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row jsonb;
  v_company_id uuid;
BEGIN
  v_row := COALESCE(new_row, old_row);
  IF v_row IS NULL THEN
    RETURN NULL;
  END IF;

  IF table_name = 'companies' THEN
    RETURN (v_row ->> 'id')::uuid;
  END IF;

  IF v_row ? 'company_id' THEN
    RETURN (v_row ->> 'company_id')::uuid;
  END IF;

  IF table_name = 'invoice_lines' THEN
    SELECT company_id INTO v_company_id
    FROM public.invoices
    WHERE id = (v_row ->> 'invoice_id')::uuid;
    RETURN v_company_id;
  ELSIF table_name = 'payment_applications' THEN
    SELECT company_id INTO v_company_id
    FROM public.payments
    WHERE id = (v_row ->> 'payment_id')::uuid;
    RETURN v_company_id;
  ELSIF table_name = 'customer_contacts' THEN
    SELECT company_id INTO v_company_id
    FROM public.customers
    WHERE id = (v_row ->> 'customer_id')::uuid;
    RETURN v_company_id;
  ELSIF table_name = 'customer_service_addresses' THEN
    SELECT company_id INTO v_company_id
    FROM public.customers
    WHERE id = (v_row ->> 'customer_id')::uuid;
    RETURN v_company_id;
  ELSIF table_name = 'payroll_run_lines' THEN
    SELECT company_id INTO v_company_id
    FROM public.payroll_runs
    WHERE id = (v_row ->> 'payroll_run_id')::uuid;
    RETURN v_company_id;
  ELSIF table_name = 'time_entry_adjustments' THEN
    SELECT company_id INTO v_company_id
    FROM public.time_entries
    WHERE id = (v_row ->> 'time_entry_id')::uuid;
    RETURN v_company_id;
  ELSIF table_name = 'owner_change_approvals' THEN
    SELECT company_id INTO v_company_id
    FROM public.owner_change_requests
    WHERE id = (v_row ->> 'request_id')::uuid;
    RETURN v_company_id;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_owner_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid;
  v_company_id uuid;
  v_before jsonb;
  v_after jsonb;
  v_diff jsonb;
  v_entity_id uuid;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_company_id := public.audit_resolve_company_id(TG_TABLE_NAME, to_jsonb(NEW), to_jsonb(OLD));
  IF v_company_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.company_owners co
    WHERE co.company_id = v_company_id
      AND co.profile_id = v_actor
  ) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_before := to_jsonb(OLD);
  v_after := to_jsonb(NEW);
  v_diff := public.audit_build_diff(v_before, v_after);

  IF TG_OP = 'INSERT' THEN
    v_entity_id := (to_jsonb(NEW) ->> 'id')::uuid;
  ELSE
    v_entity_id := (to_jsonb(OLD) ->> 'id')::uuid;
  END IF;

  INSERT INTO public.audit_logs (
    company_id,
    actor_profile_id,
    action,
    entity_table,
    entity_id,
    before,
    after,
    diff,
    metadata
  ) VALUES (
    v_company_id,
    v_actor,
    lower(TG_OP),
    TG_TABLE_NAME,
    v_entity_id,
    v_before,
    v_after,
    v_diff,
    jsonb_build_object('source', 'trigger')
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attach audit trigger to owner-managed tables
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'companies',
    'company_accountants',
    'company_employees',
    'company_owners',
    'customers',
    'customer_contacts',
    'customer_service_addresses',
    'jobs',
    'job_assignments',
    'employee_schedules',
    'employee_availability',
    'invoices',
    'invoice_lines',
    'payments',
    'payment_applications',
    'payroll_runs',
    'payroll_run_lines',
    'payroll_settings',
    'time_entries',
    'time_entry_adjustments',
    'suppliers',
    'company_business_hours',
    'owner_change_requests',
    'owner_change_approvals'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_owner_changes_%I ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER audit_owner_changes_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_owner_change()',
      t, t
    );
  END LOOP;
END $$;

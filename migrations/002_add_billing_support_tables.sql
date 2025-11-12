-- Migration: Add supporting tables for billing API routes
-- This adds tables needed for idempotency and invoice numbering
-- Run this AFTER the deposit_billing_schema.sql

-- ============================================================================
-- Idempotency Table (for POST request deduplication)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.request_idempotency (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid NOT NULL,
  idempotency_key text NOT NULL,
  route text NOT NULL,
  response_status integer NOT NULL,
  response_body jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now(),

  CONSTRAINT request_idempotency_pkey PRIMARY KEY (id),
  CONSTRAINT request_idempotency_unique UNIQUE (user_id, company_id, idempotency_key, route)
);

CREATE INDEX idx_request_idempotency_lookup
ON public.request_idempotency(user_id, company_id, idempotency_key, route);

-- Auto-expire idempotency records after 24 hours
CREATE INDEX idx_request_idempotency_created_at
ON public.request_idempotency(created_at);

COMMENT ON TABLE public.request_idempotency IS 'Stores idempotency keys for POST requests to prevent duplicate operations';

-- ============================================================================
-- Invoice Number Counter (atomic increment per company)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.company_invoice_counters (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE,
  last_number integer NOT NULL DEFAULT 10000,
  updated_at timestamp with time zone DEFAULT now(),

  CONSTRAINT company_invoice_counters_pkey PRIMARY KEY (id),
  CONSTRAINT company_invoice_counters_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id)
);

CREATE INDEX idx_company_invoice_counters_company_id
ON public.company_invoice_counters(company_id);

COMMENT ON TABLE public.company_invoice_counters IS 'Maintains sequential invoice numbers per company';

-- ============================================================================
-- Add missing columns to invoice_lines (if not already there from schema)
-- ============================================================================

-- Add job_id to invoice_lines to track which job a line came from
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='invoice_lines' AND column_name='job_id'
  ) THEN
    ALTER TABLE public.invoice_lines
    ADD COLUMN job_id uuid NULL,
    ADD CONSTRAINT invoice_lines_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id);

    CREATE INDEX idx_invoice_lines_job_id ON public.invoice_lines(job_id) WHERE job_id IS NOT NULL;
  END IF;
END $$;

-- ============================================================================
-- Cleanup Function (Optional - run periodically via cron)
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_records()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.request_idempotency
  WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$;

COMMENT ON FUNCTION cleanup_expired_idempotency_records IS 'Removes idempotency records older than 24 hours';

-- To run cleanup automatically, set up a cron job or pg_cron extension:
-- SELECT cron.schedule('cleanup-idempotency', '0 2 * * *', 'SELECT cleanup_expired_idempotency_records()');

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function to get next invoice number (safer than doing it in application code)
CREATE OR REPLACE FUNCTION get_next_invoice_number(p_company_id uuid)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_next_number integer;
BEGIN
  -- Insert or update counter atomically
  INSERT INTO public.company_invoice_counters (company_id, last_number)
  VALUES (p_company_id, 10001)
  ON CONFLICT (company_id)
  DO UPDATE SET
    last_number = company_invoice_counters.last_number + 1,
    updated_at = NOW()
  RETURNING last_number INTO v_next_number;

  RETURN v_next_number;
END;
$$;

COMMENT ON FUNCTION get_next_invoice_number IS 'Atomically gets the next invoice number for a company';

-- ============================================================================
-- Permissions (RLS)
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE public.request_idempotency ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_invoice_counters ENABLE ROW LEVEL SECURITY;

-- Idempotency: users can only see their own records
CREATE POLICY request_idempotency_user_isolation ON public.request_idempotency
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

-- Invoice counters: users can only see their company's counter
CREATE POLICY company_invoice_counters_company_isolation ON public.company_invoice_counters
  FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.company_owners WHERE profile_id = auth.uid()
    )
  );

-- ============================================================================
-- Example Usage
-- ============================================================================

-- Get next invoice number for a company:
-- SELECT get_next_invoice_number('company-uuid-here');

-- Check idempotency:
-- SELECT * FROM request_idempotency
-- WHERE user_id = 'user-uuid'
-- AND company_id = 'company-uuid'
-- AND idempotency_key = 'key-here'
-- AND route = '/api/payments';

-- ============================================================================

-- ============================================================================
-- BTRACKER DEPOSIT & BILLING SYSTEM
-- ============================================================================
-- This schema implements flexible deposit handling with:
-- - Deposits (general/parts/supplies) created at any time
-- - Payments stored as unapplied credit
-- - Deposit application via negative "Deposit Applied" invoice lines
-- - Customer billed balance (invoices - payments globally)
-- - Partial/full deposit application across multiple invoices
-- ============================================================================

-- ============================================================================
-- STEP 1: ENUMS
-- ============================================================================

-- Deposit types for categorizing deposits
CREATE TYPE deposit_type AS ENUM ('general', 'parts', 'supplies');

-- Payment method types
CREATE TYPE payment_method AS ENUM ('cash', 'check', 'credit_card', 'debit_card', 'bank_transfer', 'other');

-- Invoice status
CREATE TYPE invoice_status AS ENUM ('draft', 'issued', 'paid', 'partial', 'void', 'cancelled');

-- Invoice line types (including deposit application)
CREATE TYPE invoice_line_type AS ENUM ('service', 'parts', 'supplies', 'labor', 'deposit_applied', 'adjustment', 'other');

-- ============================================================================
-- STEP 2: PAYMENTS TABLE
-- ============================================================================
-- Payments represent cash-in events. They can be:
-- 1. Regular payments (tied to invoice via payment_applications)
-- 2. Deposits (unapplied initially, with optional deposit_type and job_id)
-- ============================================================================

CREATE TABLE public.payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  job_id uuid NULL, -- Optional: links deposit to specific job for tracking

  -- Payment details
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method payment_method NOT NULL DEFAULT 'cash',
  reference_number text, -- Check number, transaction ID, etc.
  memo text,

  -- Deposit-specific fields
  is_deposit boolean NOT NULL DEFAULT false,
  deposit_type deposit_type NULL, -- Only populated if is_deposit = true

  -- Metadata
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid NULL, -- Profile ID of creator

  CONSTRAINT payments_pkey PRIMARY KEY (id),
  CONSTRAINT payments_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT payments_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id),
  CONSTRAINT payments_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id),
  CONSTRAINT payments_deposit_type_check CHECK (
    (is_deposit = false AND deposit_type IS NULL) OR
    (is_deposit = true AND deposit_type IS NOT NULL)
  )
);

-- Indexes for performance
CREATE INDEX idx_payments_company_id ON public.payments(company_id);
CREATE INDEX idx_payments_customer_id ON public.payments(customer_id);
CREATE INDEX idx_payments_job_id ON public.payments(job_id) WHERE job_id IS NOT NULL;
CREATE INDEX idx_payments_is_deposit ON public.payments(is_deposit) WHERE is_deposit = true;
CREATE INDEX idx_payments_payment_date ON public.payments(payment_date DESC);

COMMENT ON TABLE public.payments IS 'All payments received from customers, including deposits (unapplied) and invoice payments';
COMMENT ON COLUMN public.payments.is_deposit IS 'True if this payment is a deposit (unapplied initially)';
COMMENT ON COLUMN public.payments.deposit_type IS 'Type of deposit: general, parts, or supplies';
COMMENT ON COLUMN public.payments.job_id IS 'Optional job reference for tracking which job a deposit relates to';

-- ============================================================================
-- STEP 3: INVOICES TABLE
-- ============================================================================

CREATE TABLE public.invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  job_id uuid NULL, -- Optional: invoice may relate to a specific job

  -- Invoice details
  invoice_number text NOT NULL, -- Human-readable invoice number
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NULL,
  status invoice_status NOT NULL DEFAULT 'draft',

  -- Amounts (computed from invoice_lines, but can be stored for performance)
  subtotal numeric(12,2) GENERATED ALWAYS AS (0) STORED, -- Will update via view
  tax_amount numeric(12,2) DEFAULT 0,
  total_amount numeric(12,2) GENERATED ALWAYS AS (0) STORED, -- Will update via view

  -- Notes
  notes text,
  terms text, -- Payment terms

  -- Metadata
  issued_at timestamp with time zone NULL, -- When status changed to 'issued'
  paid_at timestamp with time zone NULL, -- When fully paid
  voided_at timestamp with time zone NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid NULL,

  CONSTRAINT invoices_pkey PRIMARY KEY (id),
  CONSTRAINT invoices_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT invoices_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id),
  CONSTRAINT invoices_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id),
  CONSTRAINT invoices_invoice_number_company_unique UNIQUE (company_id, invoice_number)
);

-- Indexes
CREATE INDEX idx_invoices_company_id ON public.invoices(company_id);
CREATE INDEX idx_invoices_customer_id ON public.invoices(customer_id);
CREATE INDEX idx_invoices_job_id ON public.invoices(job_id) WHERE job_id IS NOT NULL;
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_invoices_invoice_date ON public.invoices(invoice_date DESC);
CREATE INDEX idx_invoices_invoice_number ON public.invoices(invoice_number);

COMMENT ON TABLE public.invoices IS 'Customer invoices for jobs and services';
COMMENT ON COLUMN public.invoices.invoice_number IS 'Human-readable invoice number (e.g., INV-2024-001)';

-- ============================================================================
-- STEP 4: INVOICE LINES TABLE
-- ============================================================================
-- Invoice lines include:
-- - Positive lines: services, parts, labor, etc.
-- - Negative lines: "Deposit Applied" to reduce invoice total
-- ============================================================================

CREATE TABLE public.invoice_lines (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL,

  -- Line details
  line_number integer NOT NULL, -- Order within invoice (1, 2, 3...)
  line_type invoice_line_type NOT NULL DEFAULT 'service',
  description text NOT NULL,

  -- Quantity and pricing
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL,
  line_total numeric(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,

  -- Tax
  taxable boolean DEFAULT true,
  tax_rate numeric(5,4) DEFAULT 0, -- e.g., 0.0825 for 8.25%

  -- Deposit application tracking (for deposit_applied line_type)
  applied_payment_id uuid NULL, -- References the payment being applied

  -- Metadata
  created_at timestamp with time zone DEFAULT now(),

  CONSTRAINT invoice_lines_pkey PRIMARY KEY (id),
  CONSTRAINT invoice_lines_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE,
  CONSTRAINT invoice_lines_applied_payment_id_fkey FOREIGN KEY (applied_payment_id) REFERENCES public.payments(id),
  CONSTRAINT invoice_lines_line_number_unique UNIQUE (invoice_id, line_number),
  CONSTRAINT invoice_lines_deposit_check CHECK (
    (line_type = 'deposit_applied' AND applied_payment_id IS NOT NULL AND unit_price < 0) OR
    (line_type != 'deposit_applied' AND applied_payment_id IS NULL)
  )
);

-- Indexes
CREATE INDEX idx_invoice_lines_invoice_id ON public.invoice_lines(invoice_id);
CREATE INDEX idx_invoice_lines_line_type ON public.invoice_lines(line_type);
CREATE INDEX idx_invoice_lines_applied_payment_id ON public.invoice_lines(applied_payment_id) WHERE applied_payment_id IS NOT NULL;

COMMENT ON TABLE public.invoice_lines IS 'Individual line items on invoices, including positive charges and negative deposit applications';
COMMENT ON COLUMN public.invoice_lines.line_type IS 'Type of line: service, parts, labor, deposit_applied (negative), etc.';
COMMENT ON COLUMN public.invoice_lines.applied_payment_id IS 'For deposit_applied lines: references the payment (deposit) being applied';
COMMENT ON COLUMN public.invoice_lines.unit_price IS 'Price per unit; negative for deposit_applied lines';

-- ============================================================================
-- STEP 5: PAYMENT APPLICATIONS TABLE
-- ============================================================================
-- Tracks which payments have been applied to which invoices and how much.
-- This works in tandem with negative invoice_lines for deposit applications.
-- For deposits: when we add a "Deposit Applied" line, we also record here.
-- ============================================================================

CREATE TABLE public.payment_applications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL,
  invoice_id uuid NOT NULL,

  -- Application details
  applied_amount numeric(12,2) NOT NULL CHECK (applied_amount > 0),
  applied_at timestamp with time zone DEFAULT now(),

  -- Link to the invoice line (for deposit applications)
  invoice_line_id uuid NULL, -- References the "Deposit Applied" line

  -- Metadata
  created_at timestamp with time zone DEFAULT now(),
  applied_by uuid NULL, -- Profile ID

  CONSTRAINT payment_applications_pkey PRIMARY KEY (id),
  CONSTRAINT payment_applications_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id),
  CONSTRAINT payment_applications_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id),
  CONSTRAINT payment_applications_invoice_line_id_fkey FOREIGN KEY (invoice_line_id) REFERENCES public.invoice_lines(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX idx_payment_applications_payment_id ON public.payment_applications(payment_id);
CREATE INDEX idx_payment_applications_invoice_id ON public.payment_applications(invoice_id);

COMMENT ON TABLE public.payment_applications IS 'Tracks which payments are applied to which invoices and for how much';
COMMENT ON COLUMN public.payment_applications.applied_amount IS 'Amount of this payment applied to this invoice';
COMMENT ON COLUMN public.payment_applications.invoice_line_id IS 'Optional reference to the "Deposit Applied" invoice line';

-- ============================================================================
-- STEP 6: VIEWS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- VIEW: v_customer_unapplied_payments
-- Shows unapplied credit (deposits and overpayments) available per customer
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_customer_unapplied_payments AS
WITH payment_totals AS (
  SELECT
    p.id AS payment_id,
    p.company_id,
    p.customer_id,
    p.job_id,
    p.amount AS payment_amount,
    p.is_deposit,
    p.deposit_type,
    p.payment_date,
    p.memo,
    COALESCE(SUM(pa.applied_amount), 0) AS total_applied
  FROM public.payments p
  LEFT JOIN public.payment_applications pa ON pa.payment_id = p.id
  GROUP BY p.id, p.company_id, p.customer_id, p.job_id, p.amount, p.is_deposit, p.deposit_type, p.payment_date, p.memo
)
SELECT
  payment_id,
  company_id,
  customer_id,
  job_id,
  payment_amount,
  total_applied,
  payment_amount - total_applied AS unapplied_amount,
  is_deposit,
  deposit_type,
  payment_date,
  memo,
  CASE
    WHEN payment_amount - total_applied <= 0 THEN false
    ELSE true
  END AS has_unapplied_credit
FROM payment_totals
WHERE payment_amount - total_applied > 0
ORDER BY payment_date ASC;

COMMENT ON VIEW public.v_customer_unapplied_payments IS 'Shows all payments with unapplied credit available for application to invoices';

-- ----------------------------------------------------------------------------
-- VIEW: v_invoice_summary
-- Provides invoice totals, paid/applied amounts, balance, and computed status
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_invoice_summary AS
WITH line_totals AS (
  SELECT
    invoice_id,
    SUM(line_total) AS subtotal,
    SUM(CASE WHEN taxable THEN line_total * tax_rate ELSE 0 END) AS tax_amount
  FROM public.invoice_lines
  GROUP BY invoice_id
),
payment_totals AS (
  SELECT
    invoice_id,
    SUM(applied_amount) AS total_paid
  FROM public.payment_applications
  GROUP BY invoice_id
)
SELECT
  i.id AS invoice_id,
  i.company_id,
  i.customer_id,
  i.job_id,
  i.invoice_number,
  i.invoice_date,
  i.due_date,
  i.status AS invoice_status,

  -- Amounts
  COALESCE(lt.subtotal, 0) AS subtotal,
  COALESCE(lt.tax_amount, 0) AS tax_amount,
  COALESCE(lt.subtotal, 0) + COALESCE(lt.tax_amount, 0) AS total_amount,
  COALESCE(pt.total_paid, 0) AS total_paid,
  (COALESCE(lt.subtotal, 0) + COALESCE(lt.tax_amount, 0)) - COALESCE(pt.total_paid, 0) AS balance_due,

  -- Computed status (based on actual payment state)
  CASE
    WHEN i.status = 'void' OR i.status = 'cancelled' THEN i.status
    WHEN i.status = 'draft' THEN 'draft'::invoice_status
    WHEN COALESCE(pt.total_paid, 0) = 0 THEN 'issued'::invoice_status
    WHEN COALESCE(pt.total_paid, 0) >= (COALESCE(lt.subtotal, 0) + COALESCE(lt.tax_amount, 0)) THEN 'paid'::invoice_status
    ELSE 'partial'::invoice_status
  END AS computed_status,

  -- Metadata
  i.notes,
  i.terms,
  i.issued_at,
  i.paid_at,
  i.voided_at,
  i.created_at,
  i.updated_at

FROM public.invoices i
LEFT JOIN line_totals lt ON lt.invoice_id = i.id
LEFT JOIN payment_totals pt ON pt.invoice_id = i.id;

COMMENT ON VIEW public.v_invoice_summary IS 'Complete invoice summary with totals, payments, balance, and computed status';

-- ----------------------------------------------------------------------------
-- VIEW: v_deposit_payments_by_customer_job
-- Shows deposit history by customer and job for tracking
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_deposit_payments_by_customer_job AS
SELECT
  p.id AS payment_id,
  p.company_id,
  p.customer_id,
  c.name AS customer_name,
  p.job_id,
  j.title AS job_title,
  p.amount AS deposit_amount,
  p.deposit_type,
  p.payment_date,
  p.payment_method,
  p.reference_number,
  p.memo,
  COALESCE(SUM(pa.applied_amount), 0) AS total_applied,
  p.amount - COALESCE(SUM(pa.applied_amount), 0) AS unapplied_amount,
  CASE
    WHEN p.amount - COALESCE(SUM(pa.applied_amount), 0) <= 0 THEN 'fully_applied'
    WHEN COALESCE(SUM(pa.applied_amount), 0) > 0 THEN 'partially_applied'
    ELSE 'unapplied'
  END AS application_status,
  p.created_at
FROM public.payments p
INNER JOIN public.customers c ON c.id = p.customer_id
LEFT JOIN public.jobs j ON j.id = p.job_id
LEFT JOIN public.payment_applications pa ON pa.payment_id = p.id
WHERE p.is_deposit = true
GROUP BY p.id, p.company_id, p.customer_id, c.name, p.job_id, j.title, p.amount, p.deposit_type, p.payment_date, p.payment_method, p.reference_number, p.memo, p.created_at
ORDER BY p.payment_date DESC;

COMMENT ON VIEW public.v_deposit_payments_by_customer_job IS 'Deposit payment history by customer and job with application status';

-- ----------------------------------------------------------------------------
-- VIEW: v_customer_billed_balance
-- Global customer billed balance: (all issued/active invoices) - (all payments)
-- Independent of per-invoice status
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_customer_billed_balance AS
WITH customer_invoices AS (
  SELECT
    customer_id,
    company_id,
    SUM(COALESCE(subtotal, 0) + COALESCE(tax_amount, 0)) AS total_invoiced
  FROM public.v_invoice_summary
  WHERE invoice_status NOT IN ('void', 'cancelled', 'draft')
  GROUP BY customer_id, company_id
),
customer_payments AS (
  SELECT
    customer_id,
    company_id,
    SUM(amount) AS total_payments
  FROM public.payments
  GROUP BY customer_id, company_id
)
SELECT
  c.id AS customer_id,
  c.company_id,
  c.name AS customer_name,
  COALESCE(ci.total_invoiced, 0) AS total_invoiced,
  COALESCE(cp.total_payments, 0) AS total_payments,
  COALESCE(ci.total_invoiced, 0) - COALESCE(cp.total_payments, 0) AS billed_balance,
  COALESCE(unapplied.total_unapplied, 0) AS unapplied_credit
FROM public.customers c
LEFT JOIN customer_invoices ci ON ci.customer_id = c.id AND ci.company_id = c.company_id
LEFT JOIN customer_payments cp ON cp.customer_id = c.id AND cp.company_id = c.company_id
LEFT JOIN (
  SELECT
    customer_id,
    company_id,
    SUM(unapplied_amount) AS total_unapplied
  FROM public.v_customer_unapplied_payments
  GROUP BY customer_id, company_id
) unapplied ON unapplied.customer_id = c.id AND unapplied.company_id = c.company_id
ORDER BY c.name;

COMMENT ON VIEW public.v_customer_billed_balance IS 'Global customer billed balance: total invoiced minus total payments, with unapplied credit';

-- ============================================================================
-- STEP 7: HELPER FUNCTIONS (OPTIONAL)
-- ============================================================================

-- Function to check if a deposit can be edited
CREATE OR REPLACE FUNCTION public.can_edit_deposit(payment_id_param uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM public.payments WHERE id = payment_id_param AND is_deposit = true) THEN false
      WHEN EXISTS (
        SELECT 1 FROM public.payment_applications
        WHERE payment_id = payment_id_param
      ) THEN false
      ELSE true
    END;
$$;

COMMENT ON FUNCTION public.can_edit_deposit IS 'Returns true if deposit has not been applied yet and can be edited';

-- Function to get available deposit amount
CREATE OR REPLACE FUNCTION public.get_available_deposit_amount(payment_id_param uuid)
RETURNS numeric(12,2)
LANGUAGE sql
STABLE
AS $$
  SELECT
    p.amount - COALESCE(SUM(pa.applied_amount), 0)
  FROM public.payments p
  LEFT JOIN public.payment_applications pa ON pa.payment_id = p.id
  WHERE p.id = payment_id_param AND p.is_deposit = true
  GROUP BY p.id, p.amount;
$$;

COMMENT ON FUNCTION public.get_available_deposit_amount IS 'Returns the unapplied amount remaining on a deposit';

-- ============================================================================
-- STEP 8: USAGE EXAMPLES
-- ============================================================================

-- Example variables (replace with actual UUIDs from your database)
-- DECLARE
--   v_company_id uuid := '00000000-0000-0000-0000-000000000001';
--   v_customer_id uuid := '00000000-0000-0000-0000-000000000002';
--   v_job_id uuid := '00000000-0000-0000-0000-000000000003';
--   v_profile_id uuid := '00000000-0000-0000-0000-000000000004';
--   v_deposit_id uuid;
--   v_invoice_id uuid;
--   v_deposit_line_id uuid;

-- ----------------------------------------------------------------------------
-- EXAMPLE 1: Create a deposit at job creation (no invoice yet)
-- ----------------------------------------------------------------------------

-- INSERT INTO public.payments (
--   company_id,
--   customer_id,
--   job_id,
--   amount,
--   payment_date,
--   payment_method,
--   is_deposit,
--   deposit_type,
--   memo,
--   created_by
-- ) VALUES (
--   v_company_id,
--   v_customer_id,
--   v_job_id,
--   500.00,
--   CURRENT_DATE,
--   'check',
--   true,
--   'parts',
--   'Parts deposit for HVAC replacement job',
--   v_profile_id
-- ) RETURNING id INTO v_deposit_id;

-- Result: Deposit of $500 is now stored as unapplied payment

-- ----------------------------------------------------------------------------
-- EXAMPLE 2: Check available deposits for a customer
-- ----------------------------------------------------------------------------

-- SELECT
--   payment_id,
--   deposit_type,
--   payment_amount,
--   unapplied_amount,
--   payment_date,
--   memo
-- FROM public.v_customer_unapplied_payments
-- WHERE customer_id = v_customer_id
--   AND company_id = v_company_id
--   AND has_unapplied_credit = true
-- ORDER BY payment_date ASC;

-- ----------------------------------------------------------------------------
-- EXAMPLE 3: Create an invoice and apply deposit(s)
-- ----------------------------------------------------------------------------

-- Step 3a: Create the invoice
-- INSERT INTO public.invoices (
--   company_id,
--   customer_id,
--   job_id,
--   invoice_number,
--   invoice_date,
--   due_date,
--   status,
--   terms,
--   created_by
-- ) VALUES (
--   v_company_id,
--   v_customer_id,
--   v_job_id,
--   'INV-2024-001',
--   CURRENT_DATE,
--   CURRENT_DATE + INTERVAL '30 days',
--   'issued',
--   'Net 30',
--   v_profile_id
-- ) RETURNING id INTO v_invoice_id;

-- Step 3b: Add positive invoice lines (services, parts, etc.)
-- INSERT INTO public.invoice_lines (
--   invoice_id,
--   line_number,
--   line_type,
--   description,
--   quantity,
--   unit_price,
--   taxable,
--   tax_rate
-- ) VALUES
-- (v_invoice_id, 1, 'labor', 'HVAC installation labor', 8, 150.00, true, 0.0825),
-- (v_invoice_id, 2, 'parts', 'HVAC unit and materials', 1, 2500.00, true, 0.0825);

-- Step 3c: Add negative "Deposit Applied" line
-- INSERT INTO public.invoice_lines (
--   invoice_id,
--   line_number,
--   line_type,
--   description,
--   quantity,
--   unit_price,
--   applied_payment_id,
--   taxable
-- ) VALUES (
--   v_invoice_id,
--   3,
--   'deposit_applied',
--   'Parts Deposit Applied',
--   1,
--   -500.00, -- Negative amount
--   v_deposit_id,
--   false
-- ) RETURNING id INTO v_deposit_line_id;

-- Step 3d: Record the payment application
-- INSERT INTO public.payment_applications (
--   payment_id,
--   invoice_id,
--   applied_amount,
--   invoice_line_id,
--   applied_by
-- ) VALUES (
--   v_deposit_id,
--   v_invoice_id,
--   500.00, -- Amount applied
--   v_deposit_line_id,
--   v_profile_id
-- );

-- Result: Invoice shows:
-- Labor: $1,200.00
-- Parts: $2,500.00
-- Deposit Applied: -$500.00
-- Subtotal: $3,200.00
-- Tax: $264.00
-- Total: $3,464.00

-- ----------------------------------------------------------------------------
-- EXAMPLE 4: Check invoice summary
-- ----------------------------------------------------------------------------

-- SELECT
--   invoice_number,
--   invoice_date,
--   subtotal,
--   tax_amount,
--   total_amount,
--   total_paid,
--   balance_due,
--   computed_status
-- FROM public.v_invoice_summary
-- WHERE invoice_id = v_invoice_id;

-- ----------------------------------------------------------------------------
-- EXAMPLE 5: Check customer billed balance
-- ----------------------------------------------------------------------------

-- SELECT
--   customer_name,
--   total_invoiced,
--   total_payments,
--   billed_balance,
--   unapplied_credit
-- FROM public.v_customer_billed_balance
-- WHERE customer_id = v_customer_id;

-- Result example:
-- customer_name: "ABC Company"
-- total_invoiced: $3,464.00
-- total_payments: $500.00
-- billed_balance: $2,964.00
-- unapplied_credit: $0.00 (was $500, now fully applied)

-- ----------------------------------------------------------------------------
-- EXAMPLE 6: Partial deposit application across multiple invoices
-- ----------------------------------------------------------------------------

-- Scenario: Customer has a $1,000 general deposit, apply $400 to invoice A and $600 to invoice B

-- For Invoice A: Add "Deposit Applied" line for $400
-- INSERT INTO public.invoice_lines (
--   invoice_id,
--   line_number,
--   line_type,
--   description,
--   quantity,
--   unit_price,
--   applied_payment_id,
--   taxable
-- ) VALUES (
--   v_invoice_a_id,
--   10,
--   'deposit_applied',
--   'General Deposit Applied (Partial)',
--   1,
--   -400.00,
--   v_deposit_id,
--   false
-- );

-- Record payment application for Invoice A
-- INSERT INTO public.payment_applications (
--   payment_id,
--   invoice_id,
--   applied_amount
-- ) VALUES (
--   v_deposit_id,
--   v_invoice_a_id,
--   400.00
-- );

-- For Invoice B: Add "Deposit Applied" line for $600
-- INSERT INTO public.invoice_lines (
--   invoice_id,
--   line_number,
--   line_type,
--   description,
--   quantity,
--   unit_price,
--   applied_payment_id,
--   taxable
-- ) VALUES (
--   v_invoice_b_id,
--   5,
--   'deposit_applied',
--   'General Deposit Applied (Partial)',
--   1,
--   -600.00,
--   v_deposit_id,
--   false
-- );

-- Record payment application for Invoice B
-- INSERT INTO public.payment_applications (
--   payment_id,
--   invoice_id,
--   applied_amount
-- ) VALUES (
--   v_deposit_id,
--   v_invoice_b_id,
--   600.00
-- );

-- Result: $1,000 deposit is now fully applied across two invoices

-- ----------------------------------------------------------------------------
-- EXAMPLE 7: Edit a deposit (only if not yet applied)
-- ----------------------------------------------------------------------------

-- Check if deposit can be edited
-- SELECT public.can_edit_deposit(v_deposit_id);
-- Returns: true if unapplied, false if any amount has been applied

-- If editable, update:
-- UPDATE public.payments
-- SET
--   amount = 750.00,
--   memo = 'Updated parts deposit amount',
--   updated_at = now()
-- WHERE id = v_deposit_id
--   AND public.can_edit_deposit(id) = true;

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================

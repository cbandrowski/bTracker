-- Fix v_invoice_summary view to properly calculate totals excluding deposits
-- Deposit lines should not be included in subtotal or tax calculations

-- Drop the existing view first to avoid column name conflicts
DROP VIEW IF EXISTS public.v_invoice_summary CASCADE;

CREATE VIEW public.v_invoice_summary AS
WITH line_totals AS (
  SELECT
    invoice_id,
    -- Subtotal excludes deposit lines
    SUM(CASE WHEN line_type != 'deposit_applied' THEN line_total ELSE 0 END) AS subtotal,
    -- Tax only on non-deposit lines
    SUM(CASE
      WHEN line_type != 'deposit_applied' AND taxable THEN line_total * tax_rate
      ELSE 0
    END) AS tax_amount
  FROM public.invoice_lines
  GROUP BY invoice_id
),
payment_totals AS (
  SELECT
    pa.invoice_id,
    -- Deposits applied (from payment_applications where payment is a deposit)
    SUM(CASE WHEN p.is_deposit = true THEN pa.applied_amount ELSE 0 END) AS deposit_applied,
    -- Regular payments applied (from payment_applications where payment is NOT a deposit)
    SUM(CASE WHEN p.is_deposit = false OR p.is_deposit IS NULL THEN pa.applied_amount ELSE 0 END) AS total_paid
  FROM public.payment_applications pa
  LEFT JOIN public.payments p ON p.id = pa.payment_id
  GROUP BY pa.invoice_id
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
  COALESCE(pt.deposit_applied, 0) AS deposit_applied,
  COALESCE(pt.total_paid, 0) AS total_paid,
  -- Balance = total - deposits - payments
  (COALESCE(lt.subtotal, 0) + COALESCE(lt.tax_amount, 0)) - COALESCE(pt.deposit_applied, 0) - COALESCE(pt.total_paid, 0) AS balance_due,

  -- Computed status (based on actual payment state)
  CASE
    WHEN i.status = 'void' OR i.status = 'cancelled' THEN i.status
    WHEN i.status = 'draft' THEN 'draft'::invoice_status
    WHEN COALESCE(pt.total_paid, 0) + COALESCE(pt.deposit_applied, 0) = 0 THEN 'issued'::invoice_status
    WHEN (COALESCE(pt.total_paid, 0) + COALESCE(pt.deposit_applied, 0)) >= (COALESCE(lt.subtotal, 0) + COALESCE(lt.tax_amount, 0)) THEN 'paid'::invoice_status
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

COMMENT ON VIEW public.v_invoice_summary IS 'Invoice summary with properly calculated totals: subtotal (excluding deposits) + tax = total, then subtract deposits and payments for balance';

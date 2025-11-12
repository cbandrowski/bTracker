-- Fix v_customer_billed_balance to properly sum invoice balances
-- Now that v_invoice_summary calculates balance_due correctly (total - deposits - payments),
-- we should just sum those balances instead of recalculating

DROP VIEW IF EXISTS public.v_customer_billed_balance CASCADE;

CREATE VIEW public.v_customer_billed_balance AS
WITH customer_invoices AS (
  SELECT
    customer_id,
    company_id,
    SUM(COALESCE(total_amount, 0)) AS total_invoiced,
    SUM(COALESCE(deposit_applied, 0)) AS total_deposits_applied,
    SUM(COALESCE(total_paid, 0)) AS total_payments_applied,
    SUM(COALESCE(balance_due, 0)) AS total_balance
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
  COALESCE(ci.total_deposits_applied, 0) AS total_deposits_applied,
  COALESCE(ci.total_payments_applied, 0) AS total_payments_applied,
  COALESCE(cp.total_payments, 0) AS total_payments,
  -- Billed balance is the sum of all invoice balances (which already account for deposits and payments)
  COALESCE(ci.total_balance, 0) AS billed_balance,
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

COMMENT ON VIEW public.v_customer_billed_balance IS 'Customer billed balance: sum of all invoice balance_due amounts (total - deposits - payments)';

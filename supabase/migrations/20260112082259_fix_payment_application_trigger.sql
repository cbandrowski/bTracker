BEGIN;

CREATE OR REPLACE FUNCTION public.update_invoice_status_on_payment() RETURNS trigger
    LANGUAGE plpgsql
AS $$
DECLARE
  v_invoice_id uuid;
  v_status text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_invoice_id := OLD.invoice_id;
    v_status := compute_invoice_status(v_invoice_id);

    UPDATE public.invoices
    SET
      status = v_status::invoice_status,
      paid_at = CASE
        WHEN v_status = 'paid' AND paid_at IS NULL THEN NOW()
        WHEN v_status != 'paid' THEN NULL
        ELSE paid_at
      END,
      updated_at = NOW()
    WHERE id = v_invoice_id;

    RETURN OLD;
  END IF;

  v_invoice_id := NEW.invoice_id;
  v_status := compute_invoice_status(v_invoice_id);

  UPDATE public.invoices
  SET
    status = v_status::invoice_status,
    paid_at = CASE
      WHEN v_status = 'paid' AND paid_at IS NULL THEN NOW()
      WHEN v_status != 'paid' THEN NULL
      ELSE paid_at
    END,
    updated_at = NOW()
  WHERE id = v_invoice_id;

  IF TG_OP = 'UPDATE' AND NEW.invoice_id IS DISTINCT FROM OLD.invoice_id THEN
    v_invoice_id := OLD.invoice_id;
    v_status := compute_invoice_status(v_invoice_id);

    UPDATE public.invoices
    SET
      status = v_status::invoice_status,
      paid_at = CASE
        WHEN v_status = 'paid' AND paid_at IS NULL THEN NOW()
        WHEN v_status != 'paid' THEN NULL
        ELSE paid_at
      END,
      updated_at = NOW()
    WHERE id = v_invoice_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_invoice_status_on_payment_delete ON public.payment_applications;
DROP TRIGGER IF EXISTS trigger_update_invoice_status_on_payment ON public.payment_applications;

DROP FUNCTION IF EXISTS public.update_invoice_status_on_payment_delete();

CREATE TRIGGER trigger_update_invoice_status_on_payment
AFTER INSERT OR UPDATE OR DELETE ON public.payment_applications
FOR EACH ROW EXECUTE FUNCTION public.update_invoice_status_on_payment();

COMMIT;

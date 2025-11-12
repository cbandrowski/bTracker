-- Fix invoice total_amount calculation
-- Currently it's hardcoded to 0, need to calculate from invoice_lines

-- Drop the generated column
ALTER TABLE public.invoices
DROP COLUMN IF EXISTS total_amount;

-- Add total_amount as a regular column
ALTER TABLE public.invoices
ADD COLUMN total_amount numeric(12,2) DEFAULT 0;

-- Drop subtotal generated column too
ALTER TABLE public.invoices
DROP COLUMN IF EXISTS subtotal;

-- Add subtotal as a regular column
ALTER TABLE public.invoices
ADD COLUMN subtotal numeric(12,2) DEFAULT 0;

-- Create a function to update invoice totals
CREATE OR REPLACE FUNCTION update_invoice_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_subtotal numeric(12,2);
  v_tax numeric(12,2);
  v_total numeric(12,2);
BEGIN
  -- Calculate subtotal (excluding deposits)
  SELECT COALESCE(SUM(line_total), 0)
  INTO v_subtotal
  FROM invoice_lines
  WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id)
    AND line_type != 'deposit_applied';

  -- Calculate tax (on non-deposit lines)
  SELECT COALESCE(SUM(line_total * tax_rate), 0)
  INTO v_tax
  FROM invoice_lines
  WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id)
    AND line_type != 'deposit_applied';

  -- Total = subtotal + tax
  v_total := v_subtotal + v_tax;

  -- Update invoice
  UPDATE invoices
  SET
    subtotal = v_subtotal,
    total_amount = v_total
  WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update invoice totals when lines change
DROP TRIGGER IF EXISTS trigger_update_invoice_totals ON invoice_lines;
CREATE TRIGGER trigger_update_invoice_totals
AFTER INSERT OR UPDATE OR DELETE ON invoice_lines
FOR EACH ROW
EXECUTE FUNCTION update_invoice_totals();

-- Update existing invoices
UPDATE invoices
SET
  subtotal = COALESCE((
    SELECT SUM(line_total)
    FROM invoice_lines
    WHERE invoice_id = invoices.id
      AND line_type != 'deposit_applied'
  ), 0),
  total_amount = COALESCE((
    SELECT SUM(line_total) + SUM(line_total * tax_rate)
    FROM invoice_lines
    WHERE invoice_id = invoices.id
      AND line_type != 'deposit_applied'
  ), 0);

COMMENT ON COLUMN invoices.total_amount IS 'Total amount of invoice calculated from invoice_lines';
COMMENT ON COLUMN invoices.subtotal IS 'Subtotal excluding deposit applications';

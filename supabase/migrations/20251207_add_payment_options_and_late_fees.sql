0-- Add payment acceptance toggles and late fee settings to companies table
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS accept_cash BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS accept_credit_debit BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS late_fee_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS late_fee_days INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS late_fee_amount DECIMAL(10, 2) DEFAULT 0.00;

-- Add comments for documentation
COMMENT ON COLUMN companies.accept_cash IS 'Whether the company accepts cash payments';
COMMENT ON COLUMN companies.accept_credit_debit IS 'Whether the company accepts credit/debit card payments';
COMMENT ON COLUMN companies.late_fee_enabled IS 'Whether late fees are enabled for overdue invoices';
COMMENT ON COLUMN companies.late_fee_days IS 'Number of days after receiving invoice before late fee applies';
COMMENT ON COLUMN companies.late_fee_amount IS 'Late fee amount in dollars to be applied to unpaid balances';

-- Add payment preference columns to companies table
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS paypal_handle TEXT,
ADD COLUMN IF NOT EXISTS zelle_phone TEXT,
ADD COLUMN IF NOT EXISTS zelle_email TEXT,
ADD COLUMN IF NOT EXISTS check_payable_to TEXT;

-- Add comments for documentation
COMMENT ON COLUMN companies.paypal_handle IS 'PayPal handle/username (without @ symbol)';
COMMENT ON COLUMN companies.zelle_phone IS 'Zelle phone number for payments';
COMMENT ON COLUMN companies.zelle_email IS 'Zelle email for payments';
COMMENT ON COLUMN companies.check_payable_to IS 'Name for check payments';

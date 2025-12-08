-- Ensure customers can be soft-archived
-- Adds archive columns when missing and enforces defaults for filtering
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS archived BOOLEAN,
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;

-- Make sure archived is always present and defaults to false
ALTER TABLE customers
ALTER COLUMN archived SET DEFAULT false;

UPDATE customers
SET archived = false
WHERE archived IS NULL;

ALTER TABLE customers
ALTER COLUMN archived SET NOT NULL;

COMMENT ON COLUMN customers.archived IS 'Soft-archive flag for customers';
COMMENT ON COLUMN customers.archived_at IS 'Timestamp when the customer was archived';

CREATE INDEX IF NOT EXISTS idx_customers_company_id_archived
ON customers (company_id, archived);

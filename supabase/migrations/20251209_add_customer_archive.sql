-- Add archival flags to customers without altering existing data
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN customers.archived IS 'Soft-archive flag for customers';
COMMENT ON COLUMN customers.archived_at IS 'Timestamp when the customer was archived';

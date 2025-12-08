-- Track invoice edits and deletions with metadata for compliance
CREATE TABLE IF NOT EXISTS invoice_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id),
  user_id uuid REFERENCES auth.users(id),
  action text NOT NULL CHECK (action IN ('edit', 'delete')),
  diff jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE invoice_audit_logs IS 'History of invoice edits and deletions for compliance auditing';
COMMENT ON COLUMN invoice_audit_logs.diff IS 'JSON diff containing before/after invoice snapshots';

CREATE INDEX IF NOT EXISTS idx_invoice_audit_logs_invoice_created
  ON invoice_audit_logs (invoice_id, created_at DESC);

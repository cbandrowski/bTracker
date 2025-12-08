-- Support multiple service addresses per customer
CREATE TABLE IF NOT EXISTS customer_service_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id),
  label text NOT NULL DEFAULT 'Service Address',
  address text,
  address_line_2 text,
  city text,
  state text,
  zipcode text,
  country text DEFAULT 'USA',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE customer_service_addresses IS 'Additional service locations for a customer';
COMMENT ON COLUMN customer_service_addresses.label IS 'Friendly label to identify the property';

CREATE INDEX IF NOT EXISTS idx_customer_service_addresses_customer
  ON customer_service_addresses (customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_service_addresses_company
  ON customer_service_addresses (company_id);

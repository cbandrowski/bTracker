-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,

    -- Billing address
    billing_address TEXT,
    billing_address_line_2 TEXT,
    billing_city TEXT,
    billing_state TEXT,
    billing_zipcode TEXT,
    billing_country TEXT DEFAULT 'USA',

    -- Service address (can be same as billing)
    service_address TEXT,
    service_address_line_2 TEXT,
    service_city TEXT,
    service_state TEXT,
    service_zipcode TEXT,
    service_country TEXT DEFAULT 'USA',

    -- Flag to indicate if service address is same as billing
    same_as_billing BOOLEAN DEFAULT true,

    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for company_id lookups
CREATE INDEX IF NOT EXISTS idx_customers_company_id ON customers(company_id);

-- Create composite index for efficient company-specific queries
CREATE INDEX IF NOT EXISTS idx_customers_company_id_created_at ON customers(company_id, created_at DESC);

-- Create customer_contacts table for multiple contacts per customer
CREATE TABLE IF NOT EXISTS customer_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT, -- e.g., "Owner", "Manager", "Assistant"
    phone TEXT,
    email TEXT,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for customer_id lookups
CREATE INDEX IF NOT EXISTS idx_customer_contacts_customer_id ON customer_contacts(customer_id);

-- Create index to quickly find primary contacts
CREATE INDEX IF NOT EXISTS idx_customer_contacts_is_primary ON customer_contacts(customer_id, is_primary) WHERE is_primary = true;

-- Enable Row Level Security (RLS)
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_contacts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customers table
-- Allow company owners to manage their customers
CREATE POLICY "Company owners can view their customers"
    ON customers FOR SELECT
    USING (
        company_id IN (
            SELECT company_id FROM company_owners WHERE profile_id = auth.uid()
        )
    );

CREATE POLICY "Company owners can insert their customers"
    ON customers FOR INSERT
    WITH CHECK (
        company_id IN (
            SELECT company_id FROM company_owners WHERE profile_id = auth.uid()
        )
    );

CREATE POLICY "Company owners can update their customers"
    ON customers FOR UPDATE
    USING (
        company_id IN (
            SELECT company_id FROM company_owners WHERE profile_id = auth.uid()
        )
    );

CREATE POLICY "Company owners can delete their customers"
    ON customers FOR DELETE
    USING (
        company_id IN (
            SELECT company_id FROM company_owners WHERE profile_id = auth.uid()
        )
    );

-- RLS Policies for customer_contacts table
-- Allow company owners to manage contacts for their customers
CREATE POLICY "Company owners can view customer contacts"
    ON customer_contacts FOR SELECT
    USING (
        customer_id IN (
            SELECT id FROM customers WHERE company_id IN (
                SELECT company_id FROM company_owners WHERE profile_id = auth.uid()
            )
        )
    );

CREATE POLICY "Company owners can insert customer contacts"
    ON customer_contacts FOR INSERT
    WITH CHECK (
        customer_id IN (
            SELECT id FROM customers WHERE company_id IN (
                SELECT company_id FROM company_owners WHERE profile_id = auth.uid()
            )
        )
    );

CREATE POLICY "Company owners can update customer contacts"
    ON customer_contacts FOR UPDATE
    USING (
        customer_id IN (
            SELECT id FROM customers WHERE company_id IN (
                SELECT company_id FROM company_owners WHERE profile_id = auth.uid()
            )
        )
    );

CREATE POLICY "Company owners can delete customer contacts"
    ON customer_contacts FOR DELETE
    USING (
        customer_id IN (
            SELECT id FROM customers WHERE company_id IN (
                SELECT company_id FROM company_owners WHERE profile_id = auth.uid()
            )
        )
    );

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customer_contacts_updated_at
    BEFORE UPDATE ON customer_contacts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

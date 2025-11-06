-- DEV MODE: Open policies for development
-- TODO: Tighten these policies for production

-- Allow all authenticated users to view customers (dev mode)
CREATE POLICY "dev_authenticated_users_can_view_customers"
    ON customers FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- Allow all authenticated users to view companies (dev mode)
CREATE POLICY "dev_authenticated_users_can_view_companies"
    ON companies FOR SELECT
    USING (auth.uid() IS NOT NULL);

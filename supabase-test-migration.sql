-- ==========================================
-- SIMPLE TEST MIGRATION
-- ==========================================

-- Clean slate
DROP TABLE IF EXISTS public.company_employees CASCADE;
DROP TABLE IF EXISTS public.company_owners CASCADE;
DROP TABLE IF EXISTS public.companies CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TYPE IF EXISTS employment_status CASCADE;

-- Create profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text,
  email text,
  address text,
  address_line_2 text,
  city text,
  state text,
  zipcode text,
  country text DEFAULT 'USA',
  avatar_url text,
  timezone text DEFAULT 'America/New_York',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read their own profile
CREATE POLICY "Enable read for users"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Allow authenticated users to insert their own profile
CREATE POLICY "Enable insert for users"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Allow authenticated users to update their own profile
CREATE POLICY "Enable update for users"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Grant permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.profiles TO authenticated;

-- Test: Select to confirm
SELECT 'Profiles table created with RLS!' as status;

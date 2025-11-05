-- ==========================================
-- NEW SCHEMA: Companies, Owners, Employees
-- ==========================================
-- Assumes:
--   - public schema exists (empty or clean)
--   - auth.users exists (Supabase auth)
-- ==========================================

BEGIN;

-- ==========================================
-- STEP 1: BASE TABLES
-- ==========================================

-- ---------- PROFILES ----------
-- One row per user/person.
-- Linked 1:1 to auth.users by id.
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,  -- same id as auth.users
  full_name text NOT NULL,                                         -- person's name
  phone text,                                                      -- personal phone
  email text,                                                      -- personal email (can mirror auth)
  address text,                                                    -- street address line 1
  address_line_2 text,                                             -- street address line 2
  city text,
  state text,
  zipcode text,
  country text DEFAULT 'USA',                                      -- default country
  avatar_url text,                                                 -- profile picture URL
  timezone text DEFAULT 'America/New_York',                        -- preferred timezone
  created_at timestamptz DEFAULT now(),                            -- created timestamp
  updated_at timestamptz DEFAULT now()                             -- updated timestamp
);

-- ---------- COMPANIES ----------
-- One row per company/organization.
-- No direct owner_id; ownership is modeled via company_owners.
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),   -- company id
  name text NOT NULL,                              -- company legal name
  address text,                                    -- company street address line 1
  address_line_2 text,                             -- company street address line 2
  city text,
  state text,
  zipcode text,
  country text DEFAULT 'USA',                      -- company country
  company_code text NOT NULL UNIQUE,               -- unique code (invite/join code, etc.)
  phone text,                                      -- company phone
  email text,                                      -- company general email
  website text,                                    -- company website URL
  created_at timestamptz DEFAULT now(),            -- created timestamp
  updated_at timestamptz DEFAULT now()             -- updated timestamp
);

-- ==========================================
-- STEP 2: ENUMS / TYPES
-- ==========================================

-- Employment status for employees at a company.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'employment_status') THEN
    CREATE TYPE employment_status AS ENUM ('active', 'terminated', 'on_leave');
  END IF;
END$$;

-- ==========================================
-- STEP 3: RELATION TABLES
-- ==========================================

-- ---------- COMPANY OWNERS ----------
-- Links profiles to companies as OWNERS (many-to-many).
-- A profile can own many companies; a company can have many owners.
CREATE TABLE public.company_owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),      -- ownership row id

  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE, -- owned company
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,  -- owner profile

  ownership_percentage numeric(5,2),                  -- optional percent ownership (e.g. 50.00)
  is_primary_owner boolean DEFAULT false,             -- optional flag for main owner

  created_at timestamptz DEFAULT now(),               -- created timestamp
  updated_at timestamptz DEFAULT now(),               -- updated timestamp

  UNIQUE (company_id, profile_id)                     -- one ownership row per company/profile
);

-- Optional: ensure only one primary owner per company
CREATE UNIQUE INDEX company_owners_primary_per_company_idx
  ON public.company_owners (company_id)
  WHERE is_primary_owner = true;


-- ---------- COMPANY EMPLOYEES ----------
-- Links profiles to companies as EMPLOYEES (many-to-many).
-- A profile can work for multiple companies; a company can have many employees.
CREATE TABLE public.company_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),      -- employment row id

  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE, -- employer company
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,  -- employee profile

  hire_date date NOT NULL,                            -- when the employee started at this company
  termination_date date,                              -- when they left (optional)
  job_title text,                                     -- job title at this company
  department text,                                    -- department at this company

  employment_status employment_status NOT NULL DEFAULT 'active',  -- active/on_leave/terminated
  is_manager boolean DEFAULT false,                   -- manager flag

  created_at timestamptz DEFAULT now(),               -- created timestamp
  updated_at timestamptz DEFAULT now(),               -- updated timestamp

  UNIQUE (company_id, profile_id)                     -- single current employment link per company/profile
);

-- ==========================================
-- STEP 4: INDEXES
-- ==========================================

-- Employees lookup by company
CREATE INDEX idx_company_employees_company_id
  ON public.company_employees (company_id);

-- Companies lookup by employee
CREATE INDEX idx_company_employees_profile_id
  ON public.company_employees (profile_id);

-- Owners lookup by company
CREATE INDEX idx_company_owners_company_id
  ON public.company_owners (company_id);

-- Companies lookup by owner
CREATE INDEX idx_company_owners_profile_id
  ON public.company_owners (profile_id);

-- ==========================================
-- STEP 5: ENABLE ROW LEVEL SECURITY (RLS)
-- ==========================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_employees ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- STEP 6: RLS POLICIES - PROFILES
-- ==========================================
-- GOAL:
--   - User can always see their own profile.
--   - Owners can see:
--       * profiles of all employees in their companies
--       * profiles of all other owners in their companies
--   - User can only update their own profile.
-- ==========================================

CREATE POLICY "profiles_select_own_or_company_members"
ON public.profiles
FOR SELECT
USING (
  -- User can always see their own profile
  id = auth.uid()

  OR

  -- Owners can see profiles of employees in their companies
  EXISTS (
    SELECT 1
    FROM public.company_owners co
    JOIN public.company_employees ce
      ON ce.company_id = co.company_id
    WHERE
      co.profile_id = auth.uid()       -- current user is an owner
      AND ce.profile_id = profiles.id  -- target profile is an employee
  )

  OR

  -- Owners can also see profiles of other owners in their companies
  EXISTS (
    SELECT 1
    FROM public.company_owners co_me
    JOIN public.company_owners co_other
      ON co_other.company_id = co_me.company_id
    WHERE
      co_me.profile_id = auth.uid()         -- current user is an owner
      AND co_other.profile_id = profiles.id -- target profile is another owner
  )
);

CREATE POLICY "profiles_insert_own"
ON public.profiles
FOR INSERT
WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_own"
ON public.profiles
FOR UPDATE
USING (id = auth.uid())
WITH CHECK (id = auth.uid());


-- ==========================================
-- STEP 7: RLS POLICIES - COMPANIES
-- ==========================================
-- GOAL:
--   - Owners can see companies they own.
--   - Employees can see companies they work for.
--   - Any logged-in user can create companies (optional).
--   - Only owners can update their companies.
-- ==========================================

-- SELECT: owners & employees can see related companies
CREATE POLICY "companies_select_related"
ON public.companies
FOR SELECT
USING (
  -- User is an owner of this company
  EXISTS (
    SELECT 1
    FROM public.company_owners co
    WHERE
      co.company_id = companies.id
      AND co.profile_id = auth.uid()
  )
  OR
  -- User is an employee of this company
  EXISTS (
    SELECT 1
    FROM public.company_employees ce
    WHERE
      ce.company_id = companies.id
      AND ce.profile_id = auth.uid()
  )
);

-- INSERT: allow any authenticated user to create a company
-- (they still need a separate insert into company_owners to mark themselves as owner)
CREATE POLICY "companies_insert_authenticated"
ON public.companies
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: only owners of the company can update it
CREATE POLICY "companies_update_owners_only"
ON public.companies
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.company_owners co
    WHERE
      co.company_id = companies.id
      AND co.profile_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.company_owners co
    WHERE
      co.company_id = companies.id
      AND co.profile_id = auth.uid()
  )
);

-- (Optional: you can add a DELETE policy for owners or keep deletes for service_role only)


-- ==========================================
-- STEP 8: RLS POLICIES - COMPANY_OWNERS
-- ==========================================
-- GOAL:
--   - Owners can see all owners for their companies.
--   - Owners can manage ownership rows for companies they already own.
--   - First owner row for a company is typically created via service_role.
-- ==========================================

-- SELECT: any owner of a company can see all owner rows for that company
CREATE POLICY "company_owners_select_for_owners"
ON public.company_owners
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.company_owners co_me
    WHERE
      co_me.company_id = company_owners.company_id
      AND co_me.profile_id = auth.uid()
  )
);

-- INSERT: owners can add other owners for companies they own
-- (First owner row usually inserted with service_role bypassing RLS)
CREATE POLICY "company_owners_insert_by_owner"
ON public.company_owners
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.company_owners co_me
    WHERE
      co_me.company_id = company_owners.company_id
      AND co_me.profile_id = auth.uid()
  )
);

-- UPDATE: owners can update ownership rows for companies they own
CREATE POLICY "company_owners_update_by_owner"
ON public.company_owners
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.company_owners co_me
    WHERE
      co_me.company_id = company_owners.company_id
      AND co_me.profile_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.company_owners co_me
    WHERE
      co_me.company_id = company_owners.company_id
      AND co_me.profile_id = auth.uid()
  )
);

-- DELETE: owners can delete ownership rows for companies they own
CREATE POLICY "company_owners_delete_by_owner"
ON public.company_owners
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.company_owners co_me
    WHERE
      co_me.company_id = company_owners.company_id
      AND co_me.profile_id = auth.uid()
  )
);


-- ==========================================
-- STEP 9: RLS POLICIES - COMPANY_EMPLOYEES
-- ==========================================
-- GOAL:
--   - Employees can see their own employment rows.
--   - Owners can see all employees of their companies.
--   - Owners can manage employee rows for their companies.
-- ==========================================

-- SELECT: employee sees own rows, owners see all employees in their companies
CREATE POLICY "company_employees_select_employee_or_owner"
ON public.company_employees
FOR SELECT
USING (
  -- Employee can see their own row
  profile_id = auth.uid()
  OR
  -- Owner can see all employees for their companies
  EXISTS (
    SELECT 1
    FROM public.company_owners co
    WHERE
      co.company_id = company_employees.company_id
      AND co.profile_id = auth.uid()
  )
);

-- INSERT: owners can add employees for their companies
CREATE POLICY "company_employees_insert_by_owner"
ON public.company_employees
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.company_owners co
    WHERE
      co.company_id = company_employees.company_id
      AND co.profile_id = auth.uid()
  )
);

-- UPDATE: owners can update employees for their companies
CREATE POLICY "company_employees_update_by_owner"
ON public.company_employees
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.company_owners co
    WHERE
      co.company_id = company_employees.company_id
      AND co.profile_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.company_owners co
    WHERE
      co.company_id = company_employees.company_id
      AND co.profile_id = auth.uid()
  )
);

-- DELETE: owners can delete employee rows for their companies
CREATE POLICY "company_employees_delete_by_owner"
ON public.company_employees
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.company_owners co
    WHERE
      co.company_id = company_employees.company_id
      AND co.profile_id = auth.uid()
  )
);

-- ==========================================
-- DONE
-- ==========================================

COMMIT;



SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;




ALTER SCHEMA "public" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."deposit_type" AS ENUM (
    'general',
    'parts',
    'supplies'
);


ALTER TYPE "public"."deposit_type" OWNER TO "postgres";


CREATE TYPE "public"."employment_status" AS ENUM (
    'active',
    'terminated',
    'on_leave'
);


ALTER TYPE "public"."employment_status" OWNER TO "postgres";


CREATE TYPE "public"."invoice_line_type" AS ENUM (
    'service',
    'parts',
    'supplies',
    'labor',
    'deposit_applied',
    'adjustment',
    'other'
);


ALTER TYPE "public"."invoice_line_type" OWNER TO "postgres";


CREATE TYPE "public"."invoice_status" AS ENUM (
    'draft',
    'issued',
    'paid',
    'partial',
    'void',
    'cancelled'
);


ALTER TYPE "public"."invoice_status" OWNER TO "postgres";


CREATE TYPE "public"."payment_method" AS ENUM (
    'cash',
    'check',
    'credit_card',
    'debit_card',
    'bank_transfer',
    'other'
);


ALTER TYPE "public"."payment_method" OWNER TO "postgres";


CREATE TYPE "public"."schedule_status" AS ENUM (
    'scheduled',
    'cancelled',
    'completed'
);


ALTER TYPE "public"."schedule_status" OWNER TO "postgres";


CREATE TYPE "public"."time_entry_status" AS ENUM (
    'pending_clock_in',
    'pending_approval',
    'approved',
    'rejected'
);


ALTER TYPE "public"."time_entry_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_edit_deposit"("payment_id_param" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  SELECT
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM public.payments WHERE id = payment_id_param AND is_deposit = true) THEN false
      WHEN EXISTS (
        SELECT 1 FROM public.payment_applications
        WHERE payment_id = payment_id_param
      ) THEN false
      ELSE true
    END;
$$;


ALTER FUNCTION "public"."can_edit_deposit"("payment_id_param" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."can_edit_deposit"("payment_id_param" "uuid") IS 'Returns true if deposit has not been applied yet and can be edited';



CREATE OR REPLACE FUNCTION "public"."cleanup_expired_idempotency_records"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  DELETE FROM public.request_idempotency
  WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_idempotency_records"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cleanup_expired_idempotency_records"() IS 'Removes idempotency records older than 24 hours';



CREATE OR REPLACE FUNCTION "public"."compute_invoice_status"("invoice_id_param" "uuid") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  invoice_record RECORD;
  total_applied numeric;
  balance_due numeric;
BEGIN
  -- Get invoice details
  SELECT
    i.status as current_status,
    i.total_amount,
    i.voided_at,
    i.issued_at
  INTO invoice_record
  FROM invoices i
  WHERE i.id = invoice_id_param;

  -- If voided, return void
  IF invoice_record.voided_at IS NOT NULL THEN
    RETURN 'void';
  END IF;

  -- Calculate total applied (deposits + payments)
  SELECT COALESCE(SUM(pa.applied_amount), 0)
  INTO total_applied
  FROM payment_applications pa
  WHERE pa.invoice_id = invoice_id_param;

  -- Calculate balance due
  balance_due := invoice_record.total_amount - total_applied;

  -- Determine status based on payment state
  IF balance_due <= 0 THEN
    -- Fully paid
    RETURN 'paid';
  ELSIF total_applied > 0 THEN
    -- Partial payment
    RETURN 'partial';
  ELSIF invoice_record.issued_at IS NOT NULL THEN
    -- Issued but no payment
    RETURN 'issued';
  ELSE
    -- Keep current status (likely 'draft')
    RETURN invoice_record.current_status;
  END IF;
END;
$$;


ALTER FUNCTION "public"."compute_invoice_status"("invoice_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_owner_is_employee"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- When a new owner is added or updated, ensure they have an employee record
    INSERT INTO company_employees (
        company_id,
        profile_id,
        hire_date,
        job_title,
        employment_status,
        approval_status,
        work_status,
        is_manager
    )
    VALUES (
        NEW.company_id,
        NEW.profile_id,
        CURRENT_DATE,  -- Set hire_date to today
        'Owner',       -- Job title set to "Owner"
        'active',      -- Employment status is active
        'approved',    -- Owners are auto-approved
        'available',   -- Work status is available
        true           -- Owners are managers
    )
    ON CONFLICT (company_id, profile_id) DO UPDATE
    SET
        -- If they already exist as an employee, update to ensure they have manager privileges
        is_manager = true,
        employment_status = 'active',
        approval_status = 'approved',
        -- Only update job_title to 'Owner' if it's not already set to something else
        -- This allows owners to have custom job titles if they prefer
        job_title = CASE
            WHEN company_employees.job_title IS NULL OR company_employees.job_title = ''
            THEN 'Owner'
            ELSE company_employees.job_title
        END,
        updated_at = NOW();

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."ensure_owner_is_employee"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."ensure_owner_is_employee"() IS 'Automatically creates or updates an employee record whenever someone becomes a company owner. This ensures owners can be assigned to jobs.';



CREATE OR REPLACE FUNCTION "public"."get_available_deposit_amount"("payment_id_param" "uuid") RETURNS numeric
    LANGUAGE "sql" STABLE
    AS $$
  SELECT
    p.amount - COALESCE(SUM(pa.applied_amount), 0)
  FROM public.payments p
  LEFT JOIN public.payment_applications pa ON pa.payment_id = p.id
  WHERE p.id = payment_id_param AND p.is_deposit = true
  GROUP BY p.id, p.amount;
$$;


ALTER FUNCTION "public"."get_available_deposit_amount"("payment_id_param" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_available_deposit_amount"("payment_id_param" "uuid") IS 'Returns the unapplied amount remaining on a deposit';



CREATE OR REPLACE FUNCTION "public"."get_my_employee_id"("p_company_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_employee_id UUID;
BEGIN
    -- Look up the employee record for the current authenticated user in the specified company
    SELECT id INTO v_employee_id
    FROM company_employees
    WHERE profile_id = auth.uid()
    AND company_id = p_company_id
    AND employment_status = 'active'
    AND approval_status = 'approved';

    RETURN v_employee_id;
END;
$$;


ALTER FUNCTION "public"."get_my_employee_id"("p_company_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_my_employee_id"("p_company_id" "uuid") IS 'Helper function to get the employee_id for the current authenticated user in a specific company. Returns NULL if no active, approved employee record exists.';



CREATE OR REPLACE FUNCTION "public"."get_next_invoice_number"("p_company_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_next_number integer;
BEGIN
  -- Insert or update counter atomically
  INSERT INTO public.company_invoice_counters (company_id, last_number)
  VALUES (p_company_id, 10001)
  ON CONFLICT (company_id)
  DO UPDATE SET
    last_number = company_invoice_counters.last_number + 1,
    updated_at = NOW()
  RETURNING last_number INTO v_next_number;

  RETURN v_next_number;
END;
$$;


ALTER FUNCTION "public"."get_next_invoice_number"("p_company_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_next_invoice_number"("p_company_id" "uuid") IS 'Atomically gets the next invoice number for a company';



CREATE OR REPLACE FUNCTION "public"."update_invoice_status_on_payment"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  new_status text;
BEGIN
  -- Compute the new status for the invoice
  new_status := compute_invoice_status(NEW.invoice_id);

  -- Update the invoice status
  UPDATE invoices
  SET
    status = new_status::invoice_status,
    paid_at = CASE
      WHEN new_status = 'paid' AND paid_at IS NULL THEN NOW()
      WHEN new_status != 'paid' THEN NULL
      ELSE paid_at
    END,
    updated_at = NOW()
  WHERE id = NEW.invoice_id;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_invoice_status_on_payment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_invoice_status_on_payment_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  new_status text;
BEGIN
  -- Compute the new status for the invoice
  new_status := compute_invoice_status(OLD.invoice_id);

  -- Update the invoice status
  UPDATE invoices
  SET
    status = new_status::invoice_status,
    paid_at = CASE
      WHEN new_status = 'paid' AND paid_at IS NULL THEN NOW()
      WHEN new_status != 'paid' THEN NULL
      ELSE paid_at
    END,
    updated_at = NOW()
  WHERE id = OLD.invoice_id;

  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."update_invoice_status_on_payment_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_invoice_totals"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_subtotal numeric(12,2);
  v_tax numeric(12,2);
  v_total numeric(12,2);
BEGIN
  -- Calculate subtotal (excluding deposits)
  SELECT COALESCE(SUM(line_total), 0)
  INTO v_subtotal
  FROM invoice_lines
  WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id)
    AND line_type != 'deposit_applied';

  -- Calculate tax (on non-deposit lines)
  SELECT COALESCE(SUM(line_total * tax_rate), 0)
  INTO v_tax
  FROM invoice_lines
  WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id)
    AND line_type != 'deposit_applied';

  -- Total = subtotal + tax
  v_total := v_subtotal + v_tax;

  -- Update invoice
  UPDATE invoices
  SET
    subtotal = v_subtotal,
    total_amount = v_total
  WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_invoice_totals"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_job_status_from_assignments"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    total_assignments INTEGER;
    done_assignments INTEGER;
    in_progress_assignments INTEGER;
BEGIN
    -- Count total assignments for this job
    SELECT COUNT(*) INTO total_assignments
    FROM job_assignments
    WHERE job_id = COALESCE(NEW.job_id, OLD.job_id)
    AND assignment_status != 'cancelled';

    -- Count done assignments
    SELECT COUNT(*) INTO done_assignments
    FROM job_assignments
    WHERE job_id = COALESCE(NEW.job_id, OLD.job_id)
    AND assignment_status = 'done';

    -- Count in-progress assignments
    SELECT COUNT(*) INTO in_progress_assignments
    FROM job_assignments
    WHERE job_id = COALESCE(NEW.job_id, OLD.job_id)
    AND assignment_status = 'in_progress';

    -- Update job status based on assignment statuses
    IF total_assignments > 0 AND done_assignments = total_assignments THEN
        -- All assignments are done
        UPDATE jobs SET status = 'done' WHERE id = COALESCE(NEW.job_id, OLD.job_id);
    ELSIF in_progress_assignments > 0 THEN
        -- At least one assignment is in progress
        UPDATE jobs SET status = 'in_progress' WHERE id = COALESCE(NEW.job_id, OLD.job_id);
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."update_job_status_from_assignments"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_payroll_run_lines_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_payroll_run_lines_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_payroll_runs_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_payroll_runs_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."companies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "address" "text",
    "address_line_2" "text",
    "city" "text",
    "state" "text",
    "zipcode" "text",
    "country" "text" DEFAULT 'USA'::"text",
    "company_code" "text" NOT NULL,
    "phone" "text",
    "email" "text",
    "website" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "logo_url" "text",
    "show_address_on_invoice" boolean DEFAULT true
);


ALTER TABLE "public"."companies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_accountants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "accountant_name" "text",
    "accountant_email" "text",
    "accountant_phone" "text",
    "accountant_address" "text",
    "accountant_address_line_2" "text",
    "accountant_city" "text",
    "accountant_state" "text",
    "accountant_zipcode" "text",
    "accountant_country" "text" DEFAULT 'USA'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."company_accountants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_employees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "hire_date" "date" NOT NULL,
    "termination_date" "date",
    "job_title" "text",
    "department" "text",
    "employment_status" "public"."employment_status" DEFAULT 'active'::"public"."employment_status" NOT NULL,
    "is_manager" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "approval_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "work_status" "text" DEFAULT 'available'::"text" NOT NULL,
    "hourly_rate" numeric(10,2) DEFAULT 15.00,
    CONSTRAINT "company_employees_approval_status_check" CHECK (("approval_status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"]))),
    CONSTRAINT "company_employees_work_status_check" CHECK (("work_status" = ANY (ARRAY['available'::"text", 'inactive'::"text", 'vacation'::"text", 'sick'::"text"])))
);


ALTER TABLE "public"."company_employees" OWNER TO "postgres";


COMMENT ON COLUMN "public"."company_employees"."hourly_rate" IS 'Employee hourly pay rate (used for payroll calculations)';



CREATE TABLE IF NOT EXISTS "public"."company_invoice_counters" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "last_number" integer DEFAULT 10000 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."company_invoice_counters" OWNER TO "postgres";


COMMENT ON TABLE "public"."company_invoice_counters" IS 'Maintains sequential invoice numbers per company';



CREATE TABLE IF NOT EXISTS "public"."company_owners" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "ownership_percentage" numeric(5,2),
    "is_primary_owner" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."company_owners" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "role" "text",
    "phone" "text",
    "email" "text",
    "is_primary" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."customer_contacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "phone" "text",
    "email" "text",
    "billing_address" "text",
    "billing_address_line_2" "text",
    "billing_city" "text",
    "billing_state" "text",
    "billing_zipcode" "text",
    "billing_country" "text" DEFAULT 'USA'::"text",
    "service_address" "text",
    "service_address_line_2" "text",
    "service_city" "text",
    "service_state" "text",
    "service_zipcode" "text",
    "service_country" "text" DEFAULT 'USA'::"text",
    "same_as_billing" boolean DEFAULT true,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."customers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employee_availability" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "company_employee_id" "uuid" NOT NULL,
    "day_of_week" smallint NOT NULL,
    "is_available" boolean DEFAULT false NOT NULL,
    "start_time" time without time zone,
    "end_time" time without time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "employee_availability_day_of_week_check" CHECK ((("day_of_week" >= 0) AND ("day_of_week" <= 6))),
    CONSTRAINT "employee_availability_time_valid" CHECK (((("is_available" = false) AND ("start_time" IS NULL) AND ("end_time" IS NULL)) OR (("is_available" = true) AND ("start_time" IS NOT NULL) AND ("end_time" IS NOT NULL) AND ("start_time" < "end_time"))))
);


ALTER TABLE "public"."employee_availability" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employee_schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "job_id" "uuid",
    "start_planned" timestamp with time zone NOT NULL,
    "end_planned" timestamp with time zone NOT NULL,
    "status" "public"."schedule_status" DEFAULT 'scheduled'::"public"."schedule_status" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "valid_schedule_times" CHECK (("end_planned" > "start_planned"))
);


ALTER TABLE "public"."employee_schedules" OWNER TO "postgres";


COMMENT ON TABLE "public"."employee_schedules" IS 'Planned work schedules for employees';



CREATE TABLE IF NOT EXISTS "public"."invoice_lines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_id" "uuid" NOT NULL,
    "line_number" integer NOT NULL,
    "line_type" "public"."invoice_line_type" DEFAULT 'service'::"public"."invoice_line_type" NOT NULL,
    "description" "text" NOT NULL,
    "quantity" numeric(10,2) DEFAULT 1 NOT NULL,
    "unit_price" numeric(12,2) NOT NULL,
    "line_total" numeric(12,2) GENERATED ALWAYS AS (("quantity" * "unit_price")) STORED,
    "taxable" boolean DEFAULT true,
    "tax_rate" numeric(5,4) DEFAULT 0,
    "applied_payment_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "job_id" "uuid",
    CONSTRAINT "invoice_lines_deposit_check" CHECK (((("line_type" = 'deposit_applied'::"public"."invoice_line_type") AND ("applied_payment_id" IS NOT NULL) AND ("unit_price" < (0)::numeric)) OR (("line_type" <> 'deposit_applied'::"public"."invoice_line_type") AND ("applied_payment_id" IS NULL))))
);


ALTER TABLE "public"."invoice_lines" OWNER TO "postgres";


COMMENT ON TABLE "public"."invoice_lines" IS 'Individual line items on invoices, including positive charges and negative deposit applications';



COMMENT ON COLUMN "public"."invoice_lines"."line_type" IS 'Type of line: service, parts, labor, deposit_applied (negative), etc.';



COMMENT ON COLUMN "public"."invoice_lines"."unit_price" IS 'Price per unit; negative for deposit_applied lines';



COMMENT ON COLUMN "public"."invoice_lines"."applied_payment_id" IS 'For deposit_applied lines: references the payment (deposit) being applied';



CREATE TABLE IF NOT EXISTS "public"."invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "job_id" "uuid",
    "invoice_number" "text" NOT NULL,
    "invoice_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "due_date" "date",
    "status" "public"."invoice_status" DEFAULT 'draft'::"public"."invoice_status" NOT NULL,
    "tax_amount" numeric(12,2) DEFAULT 0,
    "notes" "text",
    "terms" "text",
    "issued_at" timestamp with time zone,
    "paid_at" timestamp with time zone,
    "voided_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "total_amount" numeric(12,2) DEFAULT 0,
    "subtotal" numeric(12,2) DEFAULT 0
);


ALTER TABLE "public"."invoices" OWNER TO "postgres";


COMMENT ON TABLE "public"."invoices" IS 'Customer invoices for jobs and services';



COMMENT ON COLUMN "public"."invoices"."invoice_number" IS 'Human-readable invoice number (e.g., INV-2024-001)';



COMMENT ON COLUMN "public"."invoices"."total_amount" IS 'Total amount of invoice calculated from invoice_lines';



COMMENT ON COLUMN "public"."invoices"."subtotal" IS 'Subtotal excluding deposit applications';



CREATE TABLE IF NOT EXISTS "public"."job_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "job_id" "uuid" NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "service_start_at" timestamp with time zone,
    "service_end_at" timestamp with time zone,
    "assignment_status" "text" DEFAULT 'assigned'::"text" NOT NULL,
    "worker_confirmed_done_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "job_assignments_assignment_status_check" CHECK (("assignment_status" = ANY (ARRAY['assigned'::"text", 'in_progress'::"text", 'done'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."job_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "summary" "text",
    "service_address" "text",
    "service_address_line_2" "text",
    "service_city" "text",
    "service_state" "text",
    "service_zipcode" "text",
    "service_country" "text" DEFAULT 'USA'::"text",
    "tasks_to_complete" "text",
    "status" "text" DEFAULT 'upcoming'::"text" NOT NULL,
    "planned_end_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "estimated_amount" numeric(10,2) DEFAULT 0,
    CONSTRAINT "jobs_status_check" CHECK (("status" = ANY (ARRAY['upcoming'::"text", 'in_progress'::"text", 'done'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."jobs" OWNER TO "postgres";


COMMENT ON COLUMN "public"."jobs"."estimated_amount" IS 'Estimated amount for the job in dollars';



CREATE TABLE IF NOT EXISTS "public"."payment_applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "payment_id" "uuid" NOT NULL,
    "invoice_id" "uuid" NOT NULL,
    "applied_amount" numeric(12,2) NOT NULL,
    "applied_at" timestamp with time zone DEFAULT "now"(),
    "invoice_line_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "applied_by" "uuid",
    CONSTRAINT "payment_applications_applied_amount_check" CHECK (("applied_amount" > (0)::numeric))
);


ALTER TABLE "public"."payment_applications" OWNER TO "postgres";


COMMENT ON TABLE "public"."payment_applications" IS 'Tracks which payments are applied to which invoices and for how much';



COMMENT ON COLUMN "public"."payment_applications"."applied_amount" IS 'Amount of this payment applied to this invoice';



COMMENT ON COLUMN "public"."payment_applications"."invoice_line_id" IS 'Optional reference to the "Deposit Applied" invoice line';



CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "job_id" "uuid",
    "amount" numeric(12,2) NOT NULL,
    "payment_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "payment_method" "public"."payment_method" DEFAULT 'cash'::"public"."payment_method" NOT NULL,
    "reference_number" "text",
    "memo" "text",
    "is_deposit" boolean DEFAULT false NOT NULL,
    "deposit_type" "public"."deposit_type",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    CONSTRAINT "payments_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "payments_deposit_type_check" CHECK (((("is_deposit" = false) AND ("deposit_type" IS NULL)) OR (("is_deposit" = true) AND ("deposit_type" IS NOT NULL))))
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


COMMENT ON TABLE "public"."payments" IS 'All payments received from customers, including deposits (unapplied) and invoice payments';



COMMENT ON COLUMN "public"."payments"."job_id" IS 'Optional job reference for tracking which job a deposit relates to';



COMMENT ON COLUMN "public"."payments"."is_deposit" IS 'True if this payment is a deposit (unapplied initially)';



COMMENT ON COLUMN "public"."payments"."deposit_type" IS 'Type of deposit: general, parts, or supplies';



CREATE TABLE IF NOT EXISTS "public"."payroll_run_lines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "payroll_run_id" "uuid" NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "total_regular_hours" numeric(10,2) DEFAULT 0.00,
    "total_overtime_hours" numeric(10,2) DEFAULT 0.00,
    "hourly_rate_snapshot" numeric(10,2) NOT NULL,
    "overtime_rate_multiplier" numeric(3,2) DEFAULT 1.5,
    "regular_pay" numeric(10,2) DEFAULT 0.00,
    "overtime_pay" numeric(10,2) DEFAULT 0.00,
    "total_gross_pay" numeric(10,2) DEFAULT 0.00,
    "tax_withheld" numeric(10,2),
    "other_deductions" numeric(10,2),
    "net_pay" numeric(10,2),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."payroll_run_lines" OWNER TO "postgres";


COMMENT ON TABLE "public"."payroll_run_lines" IS 'Individual employee payroll details within a payroll run';



CREATE TABLE IF NOT EXISTS "public"."payroll_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "total_gross_pay" numeric(10,2) DEFAULT 0.00,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "payroll_runs_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'finalized'::"text"])))
);


ALTER TABLE "public"."payroll_runs" OWNER TO "postgres";


COMMENT ON TABLE "public"."payroll_runs" IS 'Represents a payroll processing run for a specific pay period';



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "phone" "text",
    "email" "text",
    "address" "text",
    "address_line_2" "text",
    "city" "text",
    "state" "text",
    "zipcode" "text",
    "country" "text" DEFAULT 'USA'::"text",
    "avatar_url" "text",
    "timezone" "text" DEFAULT 'America/New_York'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."request_idempotency" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "company_id" "uuid" NOT NULL,
    "idempotency_key" "text" NOT NULL,
    "route" "text" NOT NULL,
    "response_status" integer NOT NULL,
    "response_body" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."request_idempotency" OWNER TO "postgres";


COMMENT ON TABLE "public"."request_idempotency" IS 'Stores idempotency keys for POST requests to prevent duplicate operations';



CREATE TABLE IF NOT EXISTS "public"."time_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "schedule_id" "uuid",
    "clock_in_reported_at" timestamp with time zone NOT NULL,
    "clock_out_reported_at" timestamp with time zone,
    "clock_in_approved_at" timestamp with time zone,
    "clock_out_approved_at" timestamp with time zone,
    "status" "public"."time_entry_status" DEFAULT 'pending_clock_in'::"public"."time_entry_status" NOT NULL,
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "edit_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "payroll_run_id" "uuid",
    "regular_hours" numeric(10,2),
    "overtime_hours" numeric(10,2),
    "gross_pay" numeric(10,2),
    CONSTRAINT "approved_requires_approver" CHECK (((("status" <> 'approved'::"public"."time_entry_status") AND ("status" <> 'rejected'::"public"."time_entry_status")) OR (("approved_by" IS NOT NULL) AND ("approved_at" IS NOT NULL)))),
    CONSTRAINT "valid_approved_times" CHECK ((("clock_out_approved_at" IS NULL) OR ("clock_in_approved_at" IS NULL) OR ("clock_out_approved_at" > "clock_in_approved_at"))),
    CONSTRAINT "valid_reported_times" CHECK ((("clock_out_reported_at" IS NULL) OR ("clock_out_reported_at" > "clock_in_reported_at")))
);


ALTER TABLE "public"."time_entries" OWNER TO "postgres";


COMMENT ON TABLE "public"."time_entries" IS 'Actual time clock-in/out entries with approval workflow';



COMMENT ON COLUMN "public"."time_entries"."clock_in_reported_at" IS 'When employee says they clocked in';



COMMENT ON COLUMN "public"."time_entries"."clock_out_reported_at" IS 'When employee says they clocked out';



COMMENT ON COLUMN "public"."time_entries"."clock_in_approved_at" IS 'Owner-approved clock in time (may differ from reported)';



COMMENT ON COLUMN "public"."time_entries"."clock_out_approved_at" IS 'Owner-approved clock out time (may differ from reported)';



COMMENT ON COLUMN "public"."time_entries"."edit_reason" IS 'Reason for time adjustment by owner';



COMMENT ON COLUMN "public"."time_entries"."payroll_run_id" IS 'Links this time entry to a payroll run (null if not yet processed)';



COMMENT ON COLUMN "public"."time_entries"."regular_hours" IS 'Regular hours worked (computed at payroll time)';



COMMENT ON COLUMN "public"."time_entries"."overtime_hours" IS 'Overtime hours worked (computed at payroll time)';



COMMENT ON COLUMN "public"."time_entries"."gross_pay" IS 'Gross pay for this time entry (computed at payroll time)';



CREATE OR REPLACE VIEW "public"."v_customer_unapplied_payments" AS
 WITH "payment_totals" AS (
         SELECT "p"."id" AS "payment_id",
            "p"."company_id",
            "p"."customer_id",
            "p"."job_id",
            "p"."amount" AS "payment_amount",
            "p"."is_deposit",
            "p"."deposit_type",
            "p"."payment_date",
            "p"."memo",
            COALESCE("sum"("pa"."applied_amount"), (0)::numeric) AS "total_applied"
           FROM ("public"."payments" "p"
             LEFT JOIN "public"."payment_applications" "pa" ON (("pa"."payment_id" = "p"."id")))
          GROUP BY "p"."id", "p"."company_id", "p"."customer_id", "p"."job_id", "p"."amount", "p"."is_deposit", "p"."deposit_type", "p"."payment_date", "p"."memo"
        )
 SELECT "payment_id",
    "company_id",
    "customer_id",
    "job_id",
    "payment_amount",
    "total_applied",
    ("payment_amount" - "total_applied") AS "unapplied_amount",
    "is_deposit",
    "deposit_type",
    "payment_date",
    "memo",
        CASE
            WHEN (("payment_amount" - "total_applied") <= (0)::numeric) THEN false
            ELSE true
        END AS "has_unapplied_credit"
   FROM "payment_totals"
  WHERE (("payment_amount" - "total_applied") > (0)::numeric)
  ORDER BY "payment_date";


ALTER VIEW "public"."v_customer_unapplied_payments" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_customer_unapplied_payments" IS 'Shows all payments with unapplied credit available for application to invoices';



CREATE OR REPLACE VIEW "public"."v_invoice_summary" AS
 WITH "line_totals" AS (
         SELECT "invoice_lines"."invoice_id",
            "sum"(
                CASE
                    WHEN ("invoice_lines"."line_type" <> 'deposit_applied'::"public"."invoice_line_type") THEN "invoice_lines"."line_total"
                    ELSE (0)::numeric
                END) AS "subtotal",
            "sum"(
                CASE
                    WHEN (("invoice_lines"."line_type" <> 'deposit_applied'::"public"."invoice_line_type") AND "invoice_lines"."taxable") THEN ("invoice_lines"."line_total" * "invoice_lines"."tax_rate")
                    ELSE (0)::numeric
                END) AS "tax_amount"
           FROM "public"."invoice_lines"
          GROUP BY "invoice_lines"."invoice_id"
        ), "payment_totals" AS (
         SELECT "pa"."invoice_id",
            "sum"(
                CASE
                    WHEN ("p"."is_deposit" = true) THEN "pa"."applied_amount"
                    ELSE (0)::numeric
                END) AS "deposit_applied",
            "sum"(
                CASE
                    WHEN (("p"."is_deposit" = false) OR ("p"."is_deposit" IS NULL)) THEN "pa"."applied_amount"
                    ELSE (0)::numeric
                END) AS "total_paid"
           FROM ("public"."payment_applications" "pa"
             LEFT JOIN "public"."payments" "p" ON (("p"."id" = "pa"."payment_id")))
          GROUP BY "pa"."invoice_id"
        )
 SELECT "i"."id" AS "invoice_id",
    "i"."company_id",
    "i"."customer_id",
    "i"."job_id",
    "i"."invoice_number",
    "i"."invoice_date",
    "i"."due_date",
    "i"."status" AS "invoice_status",
    COALESCE("lt"."subtotal", (0)::numeric) AS "subtotal",
    COALESCE("lt"."tax_amount", (0)::numeric) AS "tax_amount",
    (COALESCE("lt"."subtotal", (0)::numeric) + COALESCE("lt"."tax_amount", (0)::numeric)) AS "total_amount",
    COALESCE("pt"."deposit_applied", (0)::numeric) AS "deposit_applied",
    COALESCE("pt"."total_paid", (0)::numeric) AS "total_paid",
    (((COALESCE("lt"."subtotal", (0)::numeric) + COALESCE("lt"."tax_amount", (0)::numeric)) - COALESCE("pt"."deposit_applied", (0)::numeric)) - COALESCE("pt"."total_paid", (0)::numeric)) AS "balance_due",
        CASE
            WHEN (("i"."status" = 'void'::"public"."invoice_status") OR ("i"."status" = 'cancelled'::"public"."invoice_status")) THEN "i"."status"
            WHEN ("i"."status" = 'draft'::"public"."invoice_status") THEN 'draft'::"public"."invoice_status"
            WHEN ((COALESCE("pt"."total_paid", (0)::numeric) + COALESCE("pt"."deposit_applied", (0)::numeric)) = (0)::numeric) THEN 'issued'::"public"."invoice_status"
            WHEN ((COALESCE("pt"."total_paid", (0)::numeric) + COALESCE("pt"."deposit_applied", (0)::numeric)) >= (COALESCE("lt"."subtotal", (0)::numeric) + COALESCE("lt"."tax_amount", (0)::numeric))) THEN 'paid'::"public"."invoice_status"
            ELSE 'partial'::"public"."invoice_status"
        END AS "computed_status",
    "i"."notes",
    "i"."terms",
    "i"."issued_at",
    "i"."paid_at",
    "i"."voided_at",
    "i"."created_at",
    "i"."updated_at"
   FROM (("public"."invoices" "i"
     LEFT JOIN "line_totals" "lt" ON (("lt"."invoice_id" = "i"."id")))
     LEFT JOIN "payment_totals" "pt" ON (("pt"."invoice_id" = "i"."id")));


ALTER VIEW "public"."v_invoice_summary" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_invoice_summary" IS 'Invoice summary with properly calculated totals: subtotal (excluding deposits) + tax = total, then subtract deposits and payments for balance';



CREATE OR REPLACE VIEW "public"."v_customer_billed_balance" AS
 WITH "customer_invoices" AS (
         SELECT "v_invoice_summary"."customer_id",
            "v_invoice_summary"."company_id",
            "sum"(COALESCE("v_invoice_summary"."total_amount", (0)::numeric)) AS "total_invoiced",
            "sum"(COALESCE("v_invoice_summary"."deposit_applied", (0)::numeric)) AS "total_deposits_applied",
            "sum"(COALESCE("v_invoice_summary"."total_paid", (0)::numeric)) AS "total_payments_applied",
            "sum"(COALESCE("v_invoice_summary"."balance_due", (0)::numeric)) AS "total_balance"
           FROM "public"."v_invoice_summary"
          WHERE ("v_invoice_summary"."invoice_status" <> ALL (ARRAY['void'::"public"."invoice_status", 'cancelled'::"public"."invoice_status", 'draft'::"public"."invoice_status"]))
          GROUP BY "v_invoice_summary"."customer_id", "v_invoice_summary"."company_id"
        ), "customer_payments" AS (
         SELECT "payments"."customer_id",
            "payments"."company_id",
            "sum"("payments"."amount") AS "total_payments"
           FROM "public"."payments"
          GROUP BY "payments"."customer_id", "payments"."company_id"
        )
 SELECT "c"."id" AS "customer_id",
    "c"."company_id",
    "c"."name" AS "customer_name",
    COALESCE("ci"."total_invoiced", (0)::numeric) AS "total_invoiced",
    COALESCE("ci"."total_deposits_applied", (0)::numeric) AS "total_deposits_applied",
    COALESCE("ci"."total_payments_applied", (0)::numeric) AS "total_payments_applied",
    COALESCE("cp"."total_payments", (0)::numeric) AS "total_payments",
    COALESCE("ci"."total_balance", (0)::numeric) AS "billed_balance",
    COALESCE("unapplied"."total_unapplied", (0)::numeric) AS "unapplied_credit"
   FROM ((("public"."customers" "c"
     LEFT JOIN "customer_invoices" "ci" ON ((("ci"."customer_id" = "c"."id") AND ("ci"."company_id" = "c"."company_id"))))
     LEFT JOIN "customer_payments" "cp" ON ((("cp"."customer_id" = "c"."id") AND ("cp"."company_id" = "c"."company_id"))))
     LEFT JOIN ( SELECT "v_customer_unapplied_payments"."customer_id",
            "v_customer_unapplied_payments"."company_id",
            "sum"("v_customer_unapplied_payments"."unapplied_amount") AS "total_unapplied"
           FROM "public"."v_customer_unapplied_payments"
          GROUP BY "v_customer_unapplied_payments"."customer_id", "v_customer_unapplied_payments"."company_id") "unapplied" ON ((("unapplied"."customer_id" = "c"."id") AND ("unapplied"."company_id" = "c"."company_id"))))
  ORDER BY "c"."name";


ALTER VIEW "public"."v_customer_billed_balance" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_customer_billed_balance" IS 'Customer billed balance: sum of all invoice balance_due amounts (total - deposits - payments)';



CREATE OR REPLACE VIEW "public"."v_deposit_payments_by_customer_job" AS
 SELECT "p"."id" AS "payment_id",
    "p"."company_id",
    "p"."customer_id",
    "c"."name" AS "customer_name",
    "p"."job_id",
    "j"."title" AS "job_title",
    "p"."amount" AS "deposit_amount",
    "p"."deposit_type",
    "p"."payment_date",
    "p"."payment_method",
    "p"."reference_number",
    "p"."memo",
    COALESCE("sum"("pa"."applied_amount"), (0)::numeric) AS "total_applied",
    ("p"."amount" - COALESCE("sum"("pa"."applied_amount"), (0)::numeric)) AS "unapplied_amount",
        CASE
            WHEN (("p"."amount" - COALESCE("sum"("pa"."applied_amount"), (0)::numeric)) <= (0)::numeric) THEN 'fully_applied'::"text"
            WHEN (COALESCE("sum"("pa"."applied_amount"), (0)::numeric) > (0)::numeric) THEN 'partially_applied'::"text"
            ELSE 'unapplied'::"text"
        END AS "application_status",
    "p"."created_at"
   FROM ((("public"."payments" "p"
     JOIN "public"."customers" "c" ON (("c"."id" = "p"."customer_id")))
     LEFT JOIN "public"."jobs" "j" ON (("j"."id" = "p"."job_id")))
     LEFT JOIN "public"."payment_applications" "pa" ON (("pa"."payment_id" = "p"."id")))
  WHERE ("p"."is_deposit" = true)
  GROUP BY "p"."id", "p"."company_id", "p"."customer_id", "c"."name", "p"."job_id", "j"."title", "p"."amount", "p"."deposit_type", "p"."payment_date", "p"."payment_method", "p"."reference_number", "p"."memo", "p"."created_at"
  ORDER BY "p"."payment_date" DESC;


ALTER VIEW "public"."v_deposit_payments_by_customer_job" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_deposit_payments_by_customer_job" IS 'Deposit payment history by customer and job with application status';



CREATE OR REPLACE VIEW "public"."v_employee_schedules" AS
 SELECT "es"."id",
    "es"."company_id",
    "es"."employee_id",
    "es"."job_id",
    "es"."start_planned",
    "es"."end_planned",
    "es"."status",
    "es"."notes",
    "es"."created_at",
    "es"."updated_at",
    "ce"."profile_id",
    "p"."full_name" AS "employee_name",
    "p"."email" AS "employee_email",
    "j"."title" AS "job_title",
    "c"."name" AS "customer_name"
   FROM (((("public"."employee_schedules" "es"
     JOIN "public"."company_employees" "ce" ON (("es"."employee_id" = "ce"."id")))
     JOIN "public"."profiles" "p" ON (("ce"."profile_id" = "p"."id")))
     LEFT JOIN "public"."jobs" "j" ON (("es"."job_id" = "j"."id")))
     LEFT JOIN "public"."customers" "c" ON (("j"."customer_id" = "c"."id")));


ALTER VIEW "public"."v_employee_schedules" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_pending_time_entries" AS
 SELECT "te"."id",
    "te"."company_id",
    "te"."employee_id",
    "te"."schedule_id",
    "te"."clock_in_reported_at",
    "te"."clock_out_reported_at",
    "te"."clock_in_approved_at",
    "te"."clock_out_approved_at",
    "te"."status",
    "te"."approved_by",
    "te"."approved_at",
    "te"."edit_reason",
    "te"."created_at",
    "te"."updated_at",
    "ce"."profile_id",
    "p"."full_name" AS "employee_name",
    "p"."email" AS "employee_email",
    "es"."start_planned",
    "es"."end_planned",
    "j"."title" AS "job_title",
    "c"."name" AS "customer_name"
   FROM ((((("public"."time_entries" "te"
     JOIN "public"."company_employees" "ce" ON (("te"."employee_id" = "ce"."id")))
     JOIN "public"."profiles" "p" ON (("ce"."profile_id" = "p"."id")))
     LEFT JOIN "public"."employee_schedules" "es" ON (("te"."schedule_id" = "es"."id")))
     LEFT JOIN "public"."jobs" "j" ON (("es"."job_id" = "j"."id")))
     LEFT JOIN "public"."customers" "c" ON (("j"."customer_id" = "c"."id")))
  WHERE ("te"."status" = ANY (ARRAY['pending_approval'::"public"."time_entry_status", 'pending_clock_in'::"public"."time_entry_status"]));


ALTER VIEW "public"."v_pending_time_entries" OWNER TO "postgres";


ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_company_code_key" UNIQUE ("company_code");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_accountants"
    ADD CONSTRAINT "company_accountants_company_id_key" UNIQUE ("company_id");



ALTER TABLE ONLY "public"."company_accountants"
    ADD CONSTRAINT "company_accountants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_employees"
    ADD CONSTRAINT "company_employees_company_id_profile_id_key" UNIQUE ("company_id", "profile_id");



ALTER TABLE ONLY "public"."company_employees"
    ADD CONSTRAINT "company_employees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_invoice_counters"
    ADD CONSTRAINT "company_invoice_counters_company_id_key" UNIQUE ("company_id");



ALTER TABLE ONLY "public"."company_invoice_counters"
    ADD CONSTRAINT "company_invoice_counters_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_owners"
    ADD CONSTRAINT "company_owners_company_id_profile_id_key" UNIQUE ("company_id", "profile_id");



ALTER TABLE ONLY "public"."company_owners"
    ADD CONSTRAINT "company_owners_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_contacts"
    ADD CONSTRAINT "customer_contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_availability"
    ADD CONSTRAINT "employee_availability_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_availability"
    ADD CONSTRAINT "employee_availability_unique_day" UNIQUE ("company_employee_id", "day_of_week");



ALTER TABLE ONLY "public"."employee_schedules"
    ADD CONSTRAINT "employee_schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoice_lines"
    ADD CONSTRAINT "invoice_lines_line_number_unique" UNIQUE ("invoice_id", "line_number");



ALTER TABLE ONLY "public"."invoice_lines"
    ADD CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_invoice_number_company_unique" UNIQUE ("company_id", "invoice_number");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_assignments"
    ADD CONSTRAINT "job_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payroll_runs"
    ADD CONSTRAINT "no_overlapping_periods" UNIQUE ("company_id", "period_start", "period_end");



ALTER TABLE ONLY "public"."payroll_run_lines"
    ADD CONSTRAINT "one_line_per_employee_per_run" UNIQUE ("payroll_run_id", "employee_id");



ALTER TABLE ONLY "public"."payment_applications"
    ADD CONSTRAINT "payment_applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payroll_run_lines"
    ADD CONSTRAINT "payroll_run_lines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payroll_runs"
    ADD CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."request_idempotency"
    ADD CONSTRAINT "request_idempotency_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."request_idempotency"
    ADD CONSTRAINT "request_idempotency_unique" UNIQUE ("user_id", "company_id", "idempotency_key", "route");



ALTER TABLE ONLY "public"."time_entries"
    ADD CONSTRAINT "time_entries_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "company_owners_primary_per_company_idx" ON "public"."company_owners" USING "btree" ("company_id") WHERE ("is_primary_owner" = true);



CREATE INDEX "employee_availability_company_idx" ON "public"."employee_availability" USING "btree" ("company_id");



CREATE INDEX "employee_availability_employee_idx" ON "public"."employee_availability" USING "btree" ("company_employee_id");



CREATE INDEX "idx_company_accountants_company_id" ON "public"."company_accountants" USING "btree" ("company_id");



CREATE INDEX "idx_company_employees_approval_status" ON "public"."company_employees" USING "btree" ("company_id", "approval_status");



CREATE INDEX "idx_company_employees_company_id" ON "public"."company_employees" USING "btree" ("company_id");



CREATE INDEX "idx_company_employees_hourly_rate" ON "public"."company_employees" USING "btree" ("hourly_rate") WHERE ("hourly_rate" IS NOT NULL);



CREATE INDEX "idx_company_employees_profile_id" ON "public"."company_employees" USING "btree" ("profile_id");



CREATE INDEX "idx_company_employees_work_status" ON "public"."company_employees" USING "btree" ("company_id", "work_status");



CREATE INDEX "idx_company_invoice_counters_company_id" ON "public"."company_invoice_counters" USING "btree" ("company_id");



CREATE INDEX "idx_company_owners_company_id" ON "public"."company_owners" USING "btree" ("company_id");



CREATE INDEX "idx_company_owners_profile_id" ON "public"."company_owners" USING "btree" ("profile_id");



CREATE INDEX "idx_customer_contacts_customer_id" ON "public"."customer_contacts" USING "btree" ("customer_id");



CREATE INDEX "idx_customer_contacts_is_primary" ON "public"."customer_contacts" USING "btree" ("customer_id", "is_primary") WHERE ("is_primary" = true);



CREATE INDEX "idx_customers_company_id" ON "public"."customers" USING "btree" ("company_id");



CREATE INDEX "idx_customers_company_id_created_at" ON "public"."customers" USING "btree" ("company_id", "created_at" DESC);



CREATE INDEX "idx_employee_schedules_company" ON "public"."employee_schedules" USING "btree" ("company_id");



CREATE INDEX "idx_employee_schedules_date_range" ON "public"."employee_schedules" USING "btree" ("company_id", "start_planned", "end_planned");



CREATE INDEX "idx_employee_schedules_employee" ON "public"."employee_schedules" USING "btree" ("employee_id");



CREATE INDEX "idx_employee_schedules_employee_date" ON "public"."employee_schedules" USING "btree" ("employee_id", "start_planned");



CREATE INDEX "idx_employee_schedules_job" ON "public"."employee_schedules" USING "btree" ("job_id") WHERE ("job_id" IS NOT NULL);



CREATE INDEX "idx_employee_schedules_status" ON "public"."employee_schedules" USING "btree" ("status");



CREATE INDEX "idx_invoice_lines_applied_payment_id" ON "public"."invoice_lines" USING "btree" ("applied_payment_id") WHERE ("applied_payment_id" IS NOT NULL);



CREATE INDEX "idx_invoice_lines_invoice_id" ON "public"."invoice_lines" USING "btree" ("invoice_id");



CREATE INDEX "idx_invoice_lines_job_id" ON "public"."invoice_lines" USING "btree" ("job_id") WHERE ("job_id" IS NOT NULL);



CREATE INDEX "idx_invoice_lines_line_type" ON "public"."invoice_lines" USING "btree" ("line_type");



CREATE INDEX "idx_invoices_company_id" ON "public"."invoices" USING "btree" ("company_id");



CREATE INDEX "idx_invoices_customer_id" ON "public"."invoices" USING "btree" ("customer_id");



CREATE INDEX "idx_invoices_invoice_date" ON "public"."invoices" USING "btree" ("invoice_date" DESC);



CREATE INDEX "idx_invoices_invoice_number" ON "public"."invoices" USING "btree" ("invoice_number");



CREATE INDEX "idx_invoices_job_id" ON "public"."invoices" USING "btree" ("job_id") WHERE ("job_id" IS NOT NULL);



CREATE INDEX "idx_invoices_status" ON "public"."invoices" USING "btree" ("status");



CREATE INDEX "idx_job_assignments_company_id" ON "public"."job_assignments" USING "btree" ("company_id");



CREATE INDEX "idx_job_assignments_employee_id" ON "public"."job_assignments" USING "btree" ("employee_id");



CREATE INDEX "idx_job_assignments_job_id" ON "public"."job_assignments" USING "btree" ("job_id");



CREATE INDEX "idx_job_assignments_service_dates" ON "public"."job_assignments" USING "btree" ("company_id", "service_start_at", "service_end_at");



CREATE INDEX "idx_job_assignments_status" ON "public"."job_assignments" USING "btree" ("company_id", "assignment_status");



CREATE INDEX "idx_jobs_company_id" ON "public"."jobs" USING "btree" ("company_id");



CREATE INDEX "idx_jobs_company_id_created_at" ON "public"."jobs" USING "btree" ("company_id", "created_at" DESC);



CREATE INDEX "idx_jobs_company_status" ON "public"."jobs" USING "btree" ("company_id", "status");



CREATE INDEX "idx_jobs_customer_id" ON "public"."jobs" USING "btree" ("customer_id");



CREATE INDEX "idx_payment_applications_invoice_id" ON "public"."payment_applications" USING "btree" ("invoice_id");



CREATE INDEX "idx_payment_applications_payment_id" ON "public"."payment_applications" USING "btree" ("payment_id");



CREATE INDEX "idx_payments_company_id" ON "public"."payments" USING "btree" ("company_id");



CREATE INDEX "idx_payments_customer_id" ON "public"."payments" USING "btree" ("customer_id");



CREATE INDEX "idx_payments_is_deposit" ON "public"."payments" USING "btree" ("is_deposit") WHERE ("is_deposit" = true);



CREATE INDEX "idx_payments_job_id" ON "public"."payments" USING "btree" ("job_id") WHERE ("job_id" IS NOT NULL);



CREATE INDEX "idx_payments_payment_date" ON "public"."payments" USING "btree" ("payment_date" DESC);



CREATE INDEX "idx_payroll_run_lines_employee" ON "public"."payroll_run_lines" USING "btree" ("employee_id");



CREATE INDEX "idx_payroll_run_lines_payroll_run" ON "public"."payroll_run_lines" USING "btree" ("payroll_run_id");



CREATE INDEX "idx_payroll_runs_company_period" ON "public"."payroll_runs" USING "btree" ("company_id", "period_start", "period_end");



CREATE INDEX "idx_payroll_runs_status" ON "public"."payroll_runs" USING "btree" ("status");



CREATE INDEX "idx_request_idempotency_created_at" ON "public"."request_idempotency" USING "btree" ("created_at");



CREATE INDEX "idx_request_idempotency_lookup" ON "public"."request_idempotency" USING "btree" ("user_id", "company_id", "idempotency_key", "route");



CREATE INDEX "idx_time_entries_approved_by" ON "public"."time_entries" USING "btree" ("approved_by") WHERE ("approved_by" IS NOT NULL);



CREATE INDEX "idx_time_entries_company" ON "public"."time_entries" USING "btree" ("company_id");



CREATE INDEX "idx_time_entries_date_range" ON "public"."time_entries" USING "btree" ("company_id", "clock_in_reported_at");



CREATE INDEX "idx_time_entries_employee" ON "public"."time_entries" USING "btree" ("employee_id");



CREATE INDEX "idx_time_entries_employee_date" ON "public"."time_entries" USING "btree" ("employee_id", "clock_in_reported_at");



CREATE INDEX "idx_time_entries_payroll_eligibility" ON "public"."time_entries" USING "btree" ("company_id", "status", "clock_in_approved_at") WHERE (("payroll_run_id" IS NULL) AND ("status" = 'approved'::"public"."time_entry_status"));



CREATE INDEX "idx_time_entries_payroll_run" ON "public"."time_entries" USING "btree" ("payroll_run_id");



CREATE INDEX "idx_time_entries_pending" ON "public"."time_entries" USING "btree" ("company_id", "status") WHERE ("status" = ANY (ARRAY['pending_approval'::"public"."time_entry_status", 'pending_clock_in'::"public"."time_entry_status"]));



CREATE INDEX "idx_time_entries_schedule" ON "public"."time_entries" USING "btree" ("schedule_id") WHERE ("schedule_id" IS NOT NULL);



CREATE INDEX "idx_time_entries_status" ON "public"."time_entries" USING "btree" ("status");



CREATE OR REPLACE TRIGGER "payroll_run_lines_updated_at" BEFORE UPDATE ON "public"."payroll_run_lines" FOR EACH ROW EXECUTE FUNCTION "public"."update_payroll_run_lines_updated_at"();



CREATE OR REPLACE TRIGGER "payroll_runs_updated_at" BEFORE UPDATE ON "public"."payroll_runs" FOR EACH ROW EXECUTE FUNCTION "public"."update_payroll_runs_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_ensure_owner_is_employee" AFTER INSERT OR UPDATE ON "public"."company_owners" FOR EACH ROW EXECUTE FUNCTION "public"."ensure_owner_is_employee"();



COMMENT ON TRIGGER "trigger_ensure_owner_is_employee" ON "public"."company_owners" IS 'Ensures that every company owner also has an employee record, allowing them to be assigned to jobs.';



CREATE OR REPLACE TRIGGER "trigger_update_invoice_status_on_payment" AFTER INSERT OR DELETE OR UPDATE ON "public"."payment_applications" FOR EACH ROW EXECUTE FUNCTION "public"."update_invoice_status_on_payment"();



CREATE OR REPLACE TRIGGER "trigger_update_invoice_status_on_payment_delete" AFTER DELETE ON "public"."payment_applications" FOR EACH ROW EXECUTE FUNCTION "public"."update_invoice_status_on_payment_delete"();



CREATE OR REPLACE TRIGGER "trigger_update_invoice_totals" AFTER INSERT OR DELETE OR UPDATE ON "public"."invoice_lines" FOR EACH ROW EXECUTE FUNCTION "public"."update_invoice_totals"();



CREATE OR REPLACE TRIGGER "trigger_update_job_status" AFTER INSERT OR DELETE OR UPDATE ON "public"."job_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."update_job_status_from_assignments"();



CREATE OR REPLACE TRIGGER "update_company_accountants_updated_at" BEFORE UPDATE ON "public"."company_accountants" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_customer_contacts_updated_at" BEFORE UPDATE ON "public"."customer_contacts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_customers_updated_at" BEFORE UPDATE ON "public"."customers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_employee_schedules_updated_at" BEFORE UPDATE ON "public"."employee_schedules" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_job_assignments_updated_at" BEFORE UPDATE ON "public"."job_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_jobs_updated_at" BEFORE UPDATE ON "public"."jobs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_time_entries_updated_at" BEFORE UPDATE ON "public"."time_entries" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."company_accountants"
    ADD CONSTRAINT "company_accountants_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_employees"
    ADD CONSTRAINT "company_employees_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_employees"
    ADD CONSTRAINT "company_employees_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_invoice_counters"
    ADD CONSTRAINT "company_invoice_counters_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."company_owners"
    ADD CONSTRAINT "company_owners_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_owners"
    ADD CONSTRAINT "company_owners_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_contacts"
    ADD CONSTRAINT "customer_contacts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_availability"
    ADD CONSTRAINT "employee_availability_company_employee_id_fkey" FOREIGN KEY ("company_employee_id") REFERENCES "public"."company_employees"("id");



ALTER TABLE ONLY "public"."employee_availability"
    ADD CONSTRAINT "employee_availability_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."employee_schedules"
    ADD CONSTRAINT "employee_schedules_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_schedules"
    ADD CONSTRAINT "employee_schedules_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."company_employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_schedules"
    ADD CONSTRAINT "employee_schedules_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invoice_lines"
    ADD CONSTRAINT "invoice_lines_applied_payment_id_fkey" FOREIGN KEY ("applied_payment_id") REFERENCES "public"."payments"("id");



ALTER TABLE ONLY "public"."invoice_lines"
    ADD CONSTRAINT "invoice_lines_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoice_lines"
    ADD CONSTRAINT "invoice_lines_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id");



ALTER TABLE ONLY "public"."job_assignments"
    ADD CONSTRAINT "job_assignments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_assignments"
    ADD CONSTRAINT "job_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."company_employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_assignments"
    ADD CONSTRAINT "job_assignments_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_applications"
    ADD CONSTRAINT "payment_applications_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id");



ALTER TABLE ONLY "public"."payment_applications"
    ADD CONSTRAINT "payment_applications_invoice_line_id_fkey" FOREIGN KEY ("invoice_line_id") REFERENCES "public"."invoice_lines"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payment_applications"
    ADD CONSTRAINT "payment_applications_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id");



ALTER TABLE ONLY "public"."payroll_run_lines"
    ADD CONSTRAINT "payroll_run_lines_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."company_employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payroll_run_lines"
    ADD CONSTRAINT "payroll_run_lines_payroll_run_id_fkey" FOREIGN KEY ("payroll_run_id") REFERENCES "public"."payroll_runs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payroll_runs"
    ADD CONSTRAINT "payroll_runs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payroll_runs"
    ADD CONSTRAINT "payroll_runs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."time_entries"
    ADD CONSTRAINT "time_entries_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."time_entries"
    ADD CONSTRAINT "time_entries_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."time_entries"
    ADD CONSTRAINT "time_entries_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."company_employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."time_entries"
    ADD CONSTRAINT "time_entries_payroll_run_id_fkey" FOREIGN KEY ("payroll_run_id") REFERENCES "public"."payroll_runs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."time_entries"
    ADD CONSTRAINT "time_entries_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "public"."employee_schedules"("id") ON DELETE SET NULL;



CREATE POLICY "Company owners can delete customer contacts" ON "public"."customer_contacts" FOR DELETE USING (("customer_id" IN ( SELECT "customers"."id"
   FROM "public"."customers"
  WHERE ("customers"."company_id" IN ( SELECT "company_owners"."company_id"
           FROM "public"."company_owners"
          WHERE ("company_owners"."profile_id" = "auth"."uid"()))))));



CREATE POLICY "Company owners can delete their customers" ON "public"."customers" FOR DELETE USING (("company_id" IN ( SELECT "company_owners"."company_id"
   FROM "public"."company_owners"
  WHERE ("company_owners"."profile_id" = "auth"."uid"()))));



CREATE POLICY "Company owners can insert accountants" ON "public"."company_accountants" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."company_owners"
  WHERE (("company_owners"."company_id" = "company_accountants"."company_id") AND ("company_owners"."profile_id" = "auth"."uid"())))));



CREATE POLICY "Company owners can insert customer contacts" ON "public"."customer_contacts" FOR INSERT WITH CHECK (("customer_id" IN ( SELECT "customers"."id"
   FROM "public"."customers"
  WHERE ("customers"."company_id" IN ( SELECT "company_owners"."company_id"
           FROM "public"."company_owners"
          WHERE ("company_owners"."profile_id" = "auth"."uid"()))))));



CREATE POLICY "Company owners can insert their customers" ON "public"."customers" FOR INSERT WITH CHECK (("company_id" IN ( SELECT "company_owners"."company_id"
   FROM "public"."company_owners"
  WHERE ("company_owners"."profile_id" = "auth"."uid"()))));



CREATE POLICY "Company owners can select their accountants" ON "public"."company_accountants" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."company_owners"
  WHERE (("company_owners"."company_id" = "company_accountants"."company_id") AND ("company_owners"."profile_id" = "auth"."uid"())))));



CREATE POLICY "Company owners can select their company" ON "public"."companies" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."company_owners"
  WHERE (("company_owners"."company_id" = "companies"."id") AND ("company_owners"."profile_id" = "auth"."uid"())))));



CREATE POLICY "Company owners can update customer contacts" ON "public"."customer_contacts" FOR UPDATE USING (("customer_id" IN ( SELECT "customers"."id"
   FROM "public"."customers"
  WHERE ("customers"."company_id" IN ( SELECT "company_owners"."company_id"
           FROM "public"."company_owners"
          WHERE ("company_owners"."profile_id" = "auth"."uid"()))))));



CREATE POLICY "Company owners can update their accountants" ON "public"."company_accountants" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."company_owners"
  WHERE (("company_owners"."company_id" = "company_accountants"."company_id") AND ("company_owners"."profile_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."company_owners"
  WHERE (("company_owners"."company_id" = "company_accountants"."company_id") AND ("company_owners"."profile_id" = "auth"."uid"())))));



CREATE POLICY "Company owners can update their company" ON "public"."companies" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."company_owners"
  WHERE (("company_owners"."company_id" = "companies"."id") AND ("company_owners"."profile_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."company_owners"
  WHERE (("company_owners"."company_id" = "companies"."id") AND ("company_owners"."profile_id" = "auth"."uid"())))));



CREATE POLICY "Company owners can update their customers" ON "public"."customers" FOR UPDATE USING (("company_id" IN ( SELECT "company_owners"."company_id"
   FROM "public"."company_owners"
  WHERE ("company_owners"."profile_id" = "auth"."uid"()))));



CREATE POLICY "Company owners can view customer contacts" ON "public"."customer_contacts" FOR SELECT USING (("customer_id" IN ( SELECT "customers"."id"
   FROM "public"."customers"
  WHERE ("customers"."company_id" IN ( SELECT "company_owners"."company_id"
           FROM "public"."company_owners"
          WHERE ("company_owners"."profile_id" = "auth"."uid"()))))));



CREATE POLICY "Company owners can view their customers" ON "public"."customers" FOR SELECT USING (("company_id" IN ( SELECT "company_owners"."company_id"
   FROM "public"."company_owners"
  WHERE ("company_owners"."profile_id" = "auth"."uid"()))));



CREATE POLICY "Employees can insert their own time entries" ON "public"."time_entries" FOR INSERT WITH CHECK (("employee_id" IN ( SELECT "company_employees"."id"
   FROM "public"."company_employees"
  WHERE ("company_employees"."profile_id" = "auth"."uid"()))));



CREATE POLICY "Employees can update their own time entries" ON "public"."time_entries" FOR UPDATE USING ((("employee_id" IN ( SELECT "company_employees"."id"
   FROM "public"."company_employees"
  WHERE ("company_employees"."profile_id" = "auth"."uid"()))) AND (("status" = ANY (ARRAY['pending_clock_in'::"public"."time_entry_status", 'pending_approval'::"public"."time_entry_status"])) OR (("status" = 'approved'::"public"."time_entry_status") AND ("clock_out_reported_at" IS NULL))))) WITH CHECK ((("employee_id" IN ( SELECT "company_employees"."id"
   FROM "public"."company_employees"
  WHERE ("company_employees"."profile_id" = "auth"."uid"()))) AND ("status" = ANY (ARRAY['pending_clock_in'::"public"."time_entry_status", 'pending_approval'::"public"."time_entry_status", 'approved'::"public"."time_entry_status"]))));



CREATE POLICY "Employees can view their own payroll run lines" ON "public"."payroll_run_lines" FOR SELECT USING (("employee_id" IN ( SELECT "company_employees"."id"
   FROM "public"."company_employees"
  WHERE ("company_employees"."profile_id" = "auth"."uid"()))));



CREATE POLICY "Employees can view their own schedules" ON "public"."employee_schedules" FOR SELECT USING (("employee_id" IN ( SELECT "company_employees"."id"
   FROM "public"."company_employees"
  WHERE ("company_employees"."profile_id" = "auth"."uid"()))));



CREATE POLICY "Employees can view their own time entries" ON "public"."time_entries" FOR SELECT USING (("employee_id" IN ( SELECT "company_employees"."id"
   FROM "public"."company_employees"
  WHERE ("company_employees"."profile_id" = "auth"."uid"()))));



CREATE POLICY "Owners can create payroll run lines" ON "public"."payroll_run_lines" FOR INSERT WITH CHECK (("payroll_run_id" IN ( SELECT "payroll_runs"."id"
   FROM "public"."payroll_runs"
  WHERE (("payroll_runs"."company_id" IN ( SELECT "company_owners"."company_id"
           FROM "public"."company_owners"
          WHERE ("company_owners"."profile_id" = "auth"."uid"()))) AND ("payroll_runs"."status" = 'draft'::"text")))));



CREATE POLICY "Owners can create payroll runs" ON "public"."payroll_runs" FOR INSERT WITH CHECK (("company_id" IN ( SELECT "company_owners"."company_id"
   FROM "public"."company_owners"
  WHERE ("company_owners"."profile_id" = "auth"."uid"()))));



CREATE POLICY "Owners can delete draft payroll runs" ON "public"."payroll_runs" FOR DELETE USING ((("company_id" IN ( SELECT "company_owners"."company_id"
   FROM "public"."company_owners"
  WHERE ("company_owners"."profile_id" = "auth"."uid"()))) AND ("status" = 'draft'::"text")));



CREATE POLICY "Owners can delete payroll run lines from draft runs" ON "public"."payroll_run_lines" FOR DELETE USING (("payroll_run_id" IN ( SELECT "payroll_runs"."id"
   FROM "public"."payroll_runs"
  WHERE (("payroll_runs"."company_id" IN ( SELECT "company_owners"."company_id"
           FROM "public"."company_owners"
          WHERE ("company_owners"."profile_id" = "auth"."uid"()))) AND ("payroll_runs"."status" = 'draft'::"text")))));



CREATE POLICY "Owners can delete their company schedules" ON "public"."employee_schedules" FOR DELETE USING (("company_id" IN ( SELECT "company_owners"."company_id"
   FROM "public"."company_owners"
  WHERE ("company_owners"."profile_id" = "auth"."uid"()))));



CREATE POLICY "Owners can insert their company schedules" ON "public"."employee_schedules" FOR INSERT WITH CHECK (("company_id" IN ( SELECT "company_owners"."company_id"
   FROM "public"."company_owners"
  WHERE ("company_owners"."profile_id" = "auth"."uid"()))));



CREATE POLICY "Owners can update draft payroll runs" ON "public"."payroll_runs" FOR UPDATE USING ((("company_id" IN ( SELECT "company_owners"."company_id"
   FROM "public"."company_owners"
  WHERE ("company_owners"."profile_id" = "auth"."uid"()))) AND ("status" = 'draft'::"text"))) WITH CHECK (("company_id" IN ( SELECT "company_owners"."company_id"
   FROM "public"."company_owners"
  WHERE ("company_owners"."profile_id" = "auth"."uid"()))));



CREATE POLICY "Owners can update payroll run lines in draft runs" ON "public"."payroll_run_lines" FOR UPDATE USING (("payroll_run_id" IN ( SELECT "payroll_runs"."id"
   FROM "public"."payroll_runs"
  WHERE (("payroll_runs"."company_id" IN ( SELECT "company_owners"."company_id"
           FROM "public"."company_owners"
          WHERE ("company_owners"."profile_id" = "auth"."uid"()))) AND ("payroll_runs"."status" = 'draft'::"text"))))) WITH CHECK (("payroll_run_id" IN ( SELECT "payroll_runs"."id"
   FROM "public"."payroll_runs"
  WHERE (("payroll_runs"."company_id" IN ( SELECT "company_owners"."company_id"
           FROM "public"."company_owners"
          WHERE ("company_owners"."profile_id" = "auth"."uid"()))) AND ("payroll_runs"."status" = 'draft'::"text")))));



CREATE POLICY "Owners can update their company schedules" ON "public"."employee_schedules" FOR UPDATE USING (("company_id" IN ( SELECT "company_owners"."company_id"
   FROM "public"."company_owners"
  WHERE ("company_owners"."profile_id" = "auth"."uid"()))));



CREATE POLICY "Owners can update their company time entries" ON "public"."time_entries" FOR UPDATE USING (("company_id" IN ( SELECT "company_owners"."company_id"
   FROM "public"."company_owners"
  WHERE ("company_owners"."profile_id" = "auth"."uid"())))) WITH CHECK (("company_id" IN ( SELECT "company_owners"."company_id"
   FROM "public"."company_owners"
  WHERE ("company_owners"."profile_id" = "auth"."uid"()))));



CREATE POLICY "Owners can view payroll run lines" ON "public"."payroll_run_lines" FOR SELECT USING (("payroll_run_id" IN ( SELECT "payroll_runs"."id"
   FROM "public"."payroll_runs"
  WHERE ("payroll_runs"."company_id" IN ( SELECT "company_owners"."company_id"
           FROM "public"."company_owners"
          WHERE ("company_owners"."profile_id" = "auth"."uid"()))))));



CREATE POLICY "Owners can view payroll runs" ON "public"."payroll_runs" FOR SELECT USING (("company_id" IN ( SELECT "company_owners"."company_id"
   FROM "public"."company_owners"
  WHERE ("company_owners"."profile_id" = "auth"."uid"()))));



CREATE POLICY "Owners can view their company schedules" ON "public"."employee_schedules" FOR SELECT USING (("company_id" IN ( SELECT "company_owners"."company_id"
   FROM "public"."company_owners"
  WHERE ("company_owners"."profile_id" = "auth"."uid"()))));



CREATE POLICY "Owners can view their company time entries" ON "public"."time_entries" FOR SELECT USING (("company_id" IN ( SELECT "company_owners"."company_id"
   FROM "public"."company_owners"
  WHERE ("company_owners"."profile_id" = "auth"."uid"()))));



ALTER TABLE "public"."companies" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "companies_all_authenticated" ON "public"."companies" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."company_accountants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."company_employees" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_employees_all_authenticated" ON "public"."company_employees" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."company_invoice_counters" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_invoice_counters_company_isolation" ON "public"."company_invoice_counters" TO "authenticated" USING (("company_id" IN ( SELECT "company_owners"."company_id"
   FROM "public"."company_owners"
  WHERE ("company_owners"."profile_id" = "auth"."uid"()))));



ALTER TABLE "public"."company_owners" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_owners_all_authenticated" ON "public"."company_owners" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."customer_contacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "dev_assignments_delete" ON "public"."job_assignments" FOR DELETE USING (true);



CREATE POLICY "dev_assignments_insert" ON "public"."job_assignments" FOR INSERT WITH CHECK (true);



CREATE POLICY "dev_assignments_select" ON "public"."job_assignments" FOR SELECT USING (true);



CREATE POLICY "dev_assignments_update" ON "public"."job_assignments" FOR UPDATE USING (true);



CREATE POLICY "dev_authenticated_users_can_view_companies" ON "public"."companies" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "dev_authenticated_users_can_view_customers" ON "public"."customers" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "dev_authenticated_users_can_view_employees" ON "public"."company_employees" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "dev_jobs_delete" ON "public"."jobs" FOR DELETE USING (true);



CREATE POLICY "dev_jobs_insert" ON "public"."jobs" FOR INSERT WITH CHECK (true);



CREATE POLICY "dev_jobs_select" ON "public"."jobs" FOR SELECT USING (true);



CREATE POLICY "dev_jobs_update" ON "public"."jobs" FOR UPDATE USING (true);



ALTER TABLE "public"."employee_schedules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payroll_run_lines" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payroll_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_all_authenticated" ON "public"."profiles" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."request_idempotency" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "request_idempotency_user_isolation" ON "public"."request_idempotency" TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."time_entries" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






REVOKE USAGE ON SCHEMA "public" FROM PUBLIC;
GRANT ALL ON SCHEMA "public" TO "authenticated";
GRANT ALL ON SCHEMA "public" TO "anon";
GRANT ALL ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."get_my_employee_id"("p_company_id" "uuid") TO "authenticated";


















GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."companies" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."companies" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."companies" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."company_accountants" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."company_accountants" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."company_accountants" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."company_employees" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."company_employees" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."company_employees" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."company_invoice_counters" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."company_invoice_counters" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."company_invoice_counters" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."company_owners" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."company_owners" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."company_owners" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."customer_contacts" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."customer_contacts" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."customer_contacts" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."customers" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."customers" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."customers" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."employee_availability" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."employee_availability" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."employee_availability" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."employee_schedules" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."employee_schedules" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."employee_schedules" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."invoice_lines" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."invoice_lines" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."invoice_lines" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."invoices" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."invoices" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."invoices" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."job_assignments" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."job_assignments" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."job_assignments" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."jobs" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."jobs" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."jobs" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."payment_applications" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."payment_applications" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."payment_applications" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."payments" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."payments" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."payments" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."payroll_run_lines" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."payroll_run_lines" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."payroll_run_lines" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."payroll_runs" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."payroll_runs" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."payroll_runs" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."profiles" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."profiles" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."profiles" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."request_idempotency" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."request_idempotency" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."request_idempotency" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."time_entries" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."time_entries" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."time_entries" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."v_customer_unapplied_payments" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."v_customer_unapplied_payments" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."v_customer_unapplied_payments" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."v_invoice_summary" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."v_invoice_summary" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."v_invoice_summary" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."v_customer_billed_balance" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."v_customer_billed_balance" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."v_customer_billed_balance" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."v_deposit_payments_by_customer_job" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."v_deposit_payments_by_customer_job" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."v_deposit_payments_by_customer_job" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."v_employee_schedules" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."v_employee_schedules" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."v_employee_schedules" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."v_pending_time_entries" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."v_pending_time_entries" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."v_pending_time_entries" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO "service_role";




























drop extension if exists "pg_net";

revoke references on table "public"."companies" from "anon";

revoke trigger on table "public"."companies" from "anon";

revoke truncate on table "public"."companies" from "anon";

revoke references on table "public"."companies" from "authenticated";

revoke trigger on table "public"."companies" from "authenticated";

revoke truncate on table "public"."companies" from "authenticated";

revoke references on table "public"."companies" from "service_role";

revoke trigger on table "public"."companies" from "service_role";

revoke truncate on table "public"."companies" from "service_role";

revoke references on table "public"."company_accountants" from "anon";

revoke trigger on table "public"."company_accountants" from "anon";

revoke truncate on table "public"."company_accountants" from "anon";

revoke references on table "public"."company_accountants" from "authenticated";

revoke trigger on table "public"."company_accountants" from "authenticated";

revoke truncate on table "public"."company_accountants" from "authenticated";

revoke references on table "public"."company_accountants" from "service_role";

revoke trigger on table "public"."company_accountants" from "service_role";

revoke truncate on table "public"."company_accountants" from "service_role";

revoke references on table "public"."company_employees" from "anon";

revoke trigger on table "public"."company_employees" from "anon";

revoke truncate on table "public"."company_employees" from "anon";

revoke references on table "public"."company_employees" from "authenticated";

revoke trigger on table "public"."company_employees" from "authenticated";

revoke truncate on table "public"."company_employees" from "authenticated";

revoke references on table "public"."company_employees" from "service_role";

revoke trigger on table "public"."company_employees" from "service_role";

revoke truncate on table "public"."company_employees" from "service_role";

revoke references on table "public"."company_invoice_counters" from "anon";

revoke trigger on table "public"."company_invoice_counters" from "anon";

revoke truncate on table "public"."company_invoice_counters" from "anon";

revoke references on table "public"."company_invoice_counters" from "authenticated";

revoke trigger on table "public"."company_invoice_counters" from "authenticated";

revoke truncate on table "public"."company_invoice_counters" from "authenticated";

revoke references on table "public"."company_invoice_counters" from "service_role";

revoke trigger on table "public"."company_invoice_counters" from "service_role";

revoke truncate on table "public"."company_invoice_counters" from "service_role";

revoke references on table "public"."company_owners" from "anon";

revoke trigger on table "public"."company_owners" from "anon";

revoke truncate on table "public"."company_owners" from "anon";

revoke references on table "public"."company_owners" from "authenticated";

revoke trigger on table "public"."company_owners" from "authenticated";

revoke truncate on table "public"."company_owners" from "authenticated";

revoke references on table "public"."company_owners" from "service_role";

revoke trigger on table "public"."company_owners" from "service_role";

revoke truncate on table "public"."company_owners" from "service_role";

revoke references on table "public"."customer_contacts" from "anon";

revoke trigger on table "public"."customer_contacts" from "anon";

revoke truncate on table "public"."customer_contacts" from "anon";

revoke references on table "public"."customer_contacts" from "authenticated";

revoke trigger on table "public"."customer_contacts" from "authenticated";

revoke truncate on table "public"."customer_contacts" from "authenticated";

revoke references on table "public"."customer_contacts" from "service_role";

revoke trigger on table "public"."customer_contacts" from "service_role";

revoke truncate on table "public"."customer_contacts" from "service_role";

revoke references on table "public"."customers" from "anon";

revoke trigger on table "public"."customers" from "anon";

revoke truncate on table "public"."customers" from "anon";

revoke references on table "public"."customers" from "authenticated";

revoke trigger on table "public"."customers" from "authenticated";

revoke truncate on table "public"."customers" from "authenticated";

revoke references on table "public"."customers" from "service_role";

revoke trigger on table "public"."customers" from "service_role";

revoke truncate on table "public"."customers" from "service_role";

revoke references on table "public"."employee_availability" from "anon";

revoke trigger on table "public"."employee_availability" from "anon";

revoke truncate on table "public"."employee_availability" from "anon";

revoke references on table "public"."employee_availability" from "authenticated";

revoke trigger on table "public"."employee_availability" from "authenticated";

revoke truncate on table "public"."employee_availability" from "authenticated";

revoke references on table "public"."employee_availability" from "service_role";

revoke trigger on table "public"."employee_availability" from "service_role";

revoke truncate on table "public"."employee_availability" from "service_role";

revoke references on table "public"."employee_schedules" from "anon";

revoke trigger on table "public"."employee_schedules" from "anon";

revoke truncate on table "public"."employee_schedules" from "anon";

revoke references on table "public"."employee_schedules" from "authenticated";

revoke trigger on table "public"."employee_schedules" from "authenticated";

revoke truncate on table "public"."employee_schedules" from "authenticated";

revoke references on table "public"."employee_schedules" from "service_role";

revoke trigger on table "public"."employee_schedules" from "service_role";

revoke truncate on table "public"."employee_schedules" from "service_role";

revoke references on table "public"."invoice_lines" from "anon";

revoke trigger on table "public"."invoice_lines" from "anon";

revoke truncate on table "public"."invoice_lines" from "anon";

revoke references on table "public"."invoice_lines" from "authenticated";

revoke trigger on table "public"."invoice_lines" from "authenticated";

revoke truncate on table "public"."invoice_lines" from "authenticated";

revoke references on table "public"."invoice_lines" from "service_role";

revoke trigger on table "public"."invoice_lines" from "service_role";

revoke truncate on table "public"."invoice_lines" from "service_role";

revoke references on table "public"."invoices" from "anon";

revoke trigger on table "public"."invoices" from "anon";

revoke truncate on table "public"."invoices" from "anon";

revoke references on table "public"."invoices" from "authenticated";

revoke trigger on table "public"."invoices" from "authenticated";

revoke truncate on table "public"."invoices" from "authenticated";

revoke references on table "public"."invoices" from "service_role";

revoke trigger on table "public"."invoices" from "service_role";

revoke truncate on table "public"."invoices" from "service_role";

revoke references on table "public"."job_assignments" from "anon";

revoke trigger on table "public"."job_assignments" from "anon";

revoke truncate on table "public"."job_assignments" from "anon";

revoke references on table "public"."job_assignments" from "authenticated";

revoke trigger on table "public"."job_assignments" from "authenticated";

revoke truncate on table "public"."job_assignments" from "authenticated";

revoke references on table "public"."job_assignments" from "service_role";

revoke trigger on table "public"."job_assignments" from "service_role";

revoke truncate on table "public"."job_assignments" from "service_role";

revoke references on table "public"."jobs" from "anon";

revoke trigger on table "public"."jobs" from "anon";

revoke truncate on table "public"."jobs" from "anon";

revoke references on table "public"."jobs" from "authenticated";

revoke trigger on table "public"."jobs" from "authenticated";

revoke truncate on table "public"."jobs" from "authenticated";

revoke references on table "public"."jobs" from "service_role";

revoke trigger on table "public"."jobs" from "service_role";

revoke truncate on table "public"."jobs" from "service_role";

revoke references on table "public"."payment_applications" from "anon";

revoke trigger on table "public"."payment_applications" from "anon";

revoke truncate on table "public"."payment_applications" from "anon";

revoke references on table "public"."payment_applications" from "authenticated";

revoke trigger on table "public"."payment_applications" from "authenticated";

revoke truncate on table "public"."payment_applications" from "authenticated";

revoke references on table "public"."payment_applications" from "service_role";

revoke trigger on table "public"."payment_applications" from "service_role";

revoke truncate on table "public"."payment_applications" from "service_role";

revoke references on table "public"."payments" from "anon";

revoke trigger on table "public"."payments" from "anon";

revoke truncate on table "public"."payments" from "anon";

revoke references on table "public"."payments" from "authenticated";

revoke trigger on table "public"."payments" from "authenticated";

revoke truncate on table "public"."payments" from "authenticated";

revoke references on table "public"."payments" from "service_role";

revoke trigger on table "public"."payments" from "service_role";

revoke truncate on table "public"."payments" from "service_role";

revoke references on table "public"."payroll_run_lines" from "anon";

revoke trigger on table "public"."payroll_run_lines" from "anon";

revoke truncate on table "public"."payroll_run_lines" from "anon";

revoke references on table "public"."payroll_run_lines" from "authenticated";

revoke trigger on table "public"."payroll_run_lines" from "authenticated";

revoke truncate on table "public"."payroll_run_lines" from "authenticated";

revoke references on table "public"."payroll_run_lines" from "service_role";

revoke trigger on table "public"."payroll_run_lines" from "service_role";

revoke truncate on table "public"."payroll_run_lines" from "service_role";

revoke references on table "public"."payroll_runs" from "anon";

revoke trigger on table "public"."payroll_runs" from "anon";

revoke truncate on table "public"."payroll_runs" from "anon";

revoke references on table "public"."payroll_runs" from "authenticated";

revoke trigger on table "public"."payroll_runs" from "authenticated";

revoke truncate on table "public"."payroll_runs" from "authenticated";

revoke references on table "public"."payroll_runs" from "service_role";

revoke trigger on table "public"."payroll_runs" from "service_role";

revoke truncate on table "public"."payroll_runs" from "service_role";

revoke references on table "public"."profiles" from "anon";

revoke trigger on table "public"."profiles" from "anon";

revoke truncate on table "public"."profiles" from "anon";

revoke references on table "public"."profiles" from "authenticated";

revoke trigger on table "public"."profiles" from "authenticated";

revoke truncate on table "public"."profiles" from "authenticated";

revoke references on table "public"."profiles" from "service_role";

revoke trigger on table "public"."profiles" from "service_role";

revoke truncate on table "public"."profiles" from "service_role";

revoke references on table "public"."request_idempotency" from "anon";

revoke trigger on table "public"."request_idempotency" from "anon";

revoke truncate on table "public"."request_idempotency" from "anon";

revoke references on table "public"."request_idempotency" from "authenticated";

revoke trigger on table "public"."request_idempotency" from "authenticated";

revoke truncate on table "public"."request_idempotency" from "authenticated";

revoke references on table "public"."request_idempotency" from "service_role";

revoke trigger on table "public"."request_idempotency" from "service_role";

revoke truncate on table "public"."request_idempotency" from "service_role";

revoke references on table "public"."time_entries" from "anon";

revoke trigger on table "public"."time_entries" from "anon";

revoke truncate on table "public"."time_entries" from "anon";

revoke references on table "public"."time_entries" from "authenticated";

revoke trigger on table "public"."time_entries" from "authenticated";

revoke truncate on table "public"."time_entries" from "authenticated";

revoke references on table "public"."time_entries" from "service_role";

revoke trigger on table "public"."time_entries" from "service_role";

revoke truncate on table "public"."time_entries" from "service_role";


  create policy "Owners can delete logos from their company folder"
  on "storage"."objects"
  as permissive
  for delete
  to public
using (((bucket_id = 'company_logos'::text) AND (auth.uid() IS NOT NULL) AND ((storage.foldername(name))[1] IN ( SELECT (company_owners.company_id)::text AS company_id
   FROM public.company_owners
  WHERE (company_owners.profile_id = auth.uid())))));



  create policy "Owners can update logos in their company folder"
  on "storage"."objects"
  as permissive
  for update
  to public
using (((bucket_id = 'company_logos'::text) AND (auth.uid() IS NOT NULL) AND ((storage.foldername(name))[1] IN ( SELECT (company_owners.company_id)::text AS company_id
   FROM public.company_owners
  WHERE (company_owners.profile_id = auth.uid())))))
with check (((bucket_id = 'company_logos'::text) AND (auth.uid() IS NOT NULL) AND ((storage.foldername(name))[1] IN ( SELECT (company_owners.company_id)::text AS company_id
   FROM public.company_owners
  WHERE (company_owners.profile_id = auth.uid())))));



  create policy "Owners can upload logos to their company folder"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'company_logos'::text) AND (auth.uid() IS NOT NULL) AND ((storage.foldername(name))[1] IN ( SELECT (company_owners.company_id)::text AS company_id
   FROM public.company_owners
  WHERE (company_owners.profile_id = auth.uid())))));



  create policy "Public read access to company logos"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'company_logos'::text));




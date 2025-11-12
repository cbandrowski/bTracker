-- Add estimated_amount column to jobs table
-- This column stores the estimated cost/price for the job

ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS estimated_amount numeric(10,2) DEFAULT 0;

COMMENT ON COLUMN public.jobs.estimated_amount IS 'Estimated amount for the job in dollars';

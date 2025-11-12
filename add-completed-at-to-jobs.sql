-- Add completed_at column to jobs table
-- This column tracks when a job's status was changed to 'done'

ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone;

-- Optionally, set completed_at for existing 'done' jobs to their updated_at timestamp
UPDATE public.jobs
SET completed_at = updated_at
WHERE status = 'done' AND completed_at IS NULL;

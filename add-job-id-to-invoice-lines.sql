-- Add job_id column to invoice_lines table
-- This links invoice lines back to the originating job

ALTER TABLE public.invoice_lines
ADD COLUMN IF NOT EXISTS job_id uuid NULL;

ALTER TABLE public.invoice_lines
ADD CONSTRAINT invoice_lines_job_id_fkey
FOREIGN KEY (job_id) REFERENCES public.jobs(id);

CREATE INDEX IF NOT EXISTS idx_invoice_lines_job_id ON public.invoice_lines(job_id) WHERE job_id IS NOT NULL;

COMMENT ON COLUMN public.invoice_lines.job_id IS 'Optional reference to the job this line item is for';

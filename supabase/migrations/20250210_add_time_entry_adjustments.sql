-- Time Entry Adjustments Audit Trail
-- Tracks all modifications to time entries for accountability

CREATE TABLE IF NOT EXISTS public.time_entry_adjustments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    time_entry_id uuid NOT NULL REFERENCES public.time_entries(id) ON DELETE CASCADE,
    adjusted_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

    -- Original values before adjustment
    original_clock_in timestamp with time zone,
    original_clock_out timestamp with time zone,

    -- New values after adjustment
    new_clock_in timestamp with time zone,
    new_clock_out timestamp with time zone,

    -- Reason for adjustment
    adjustment_reason text NOT NULL,

    -- Timestamps
    adjusted_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT valid_adjustment_times CHECK (
        new_clock_in IS NULL OR
        new_clock_out IS NULL OR
        new_clock_out > new_clock_in
    )
);

-- Indexes for performance
CREATE INDEX idx_time_entry_adjustments_time_entry ON public.time_entry_adjustments(time_entry_id);
CREATE INDEX idx_time_entry_adjustments_adjusted_by ON public.time_entry_adjustments(adjusted_by);
CREATE INDEX idx_time_entry_adjustments_date ON public.time_entry_adjustments(adjusted_at);

-- Comments
COMMENT ON TABLE public.time_entry_adjustments IS 'Audit trail for all time entry modifications';
COMMENT ON COLUMN public.time_entry_adjustments.original_clock_in IS 'Clock in time before adjustment';
COMMENT ON COLUMN public.time_entry_adjustments.original_clock_out IS 'Clock out time before adjustment';
COMMENT ON COLUMN public.time_entry_adjustments.new_clock_in IS 'Clock in time after adjustment';
COMMENT ON COLUMN public.time_entry_adjustments.new_clock_out IS 'Clock out time after adjustment';

-- RLS Policies
ALTER TABLE public.time_entry_adjustments ENABLE ROW LEVEL SECURITY;

-- Owners can view adjustments for their company's time entries
CREATE POLICY "Owners can view their company time entry adjustments"
ON public.time_entry_adjustments
FOR SELECT
USING (
    time_entry_id IN (
        SELECT te.id
        FROM public.time_entries te
        WHERE te.company_id IN (
            SELECT company_id
            FROM public.company_owners
            WHERE profile_id = auth.uid()
        )
    )
);

-- Owners can insert adjustments for their company's time entries
CREATE POLICY "Owners can insert time entry adjustments"
ON public.time_entry_adjustments
FOR INSERT
WITH CHECK (
    time_entry_id IN (
        SELECT te.id
        FROM public.time_entries te
        WHERE te.company_id IN (
            SELECT company_id
            FROM public.company_owners
            WHERE profile_id = auth.uid()
        )
    )
);

-- Grant permissions
GRANT SELECT, INSERT ON TABLE public.time_entry_adjustments TO authenticated;
GRANT ALL ON TABLE public.time_entry_adjustments TO service_role;

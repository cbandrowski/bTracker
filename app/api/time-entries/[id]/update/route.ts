import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUser, getUserCompanyIds } from '@/lib/supabaseServer'
import { z } from 'zod'

const UpdateSchema = z.object({
  clock_in_approved_at: z.string().datetime(),
  clock_out_approved_at: z.string().datetime(),
  edit_reason: z.string().optional().nullable(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient()
    const user = await getCurrentUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const companyIds = await getUserCompanyIds(supabase, user.id)
    if (companyIds.length === 0) {
      return NextResponse.json({ error: 'No company found' }, { status: 404 })
    }
    const companyId = companyIds[0]
    const { id: timeEntryId } = await params

    const body = await request.json()
    const parsed = UpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation error', details: parsed.error.issues }, { status: 422 })
    }

    const { clock_in_approved_at, clock_out_approved_at, edit_reason } = parsed.data

    if (new Date(clock_out_approved_at) <= new Date(clock_in_approved_at)) {
      return NextResponse.json({ error: 'Clock out time must be after clock in time' }, { status: 400 })
    }

    const { data: timeEntry, error: fetchError } = await supabase
      .from('time_entries')
      .select('id, company_id, status, payroll_run_id, clock_in_approved_at, clock_out_approved_at')
      .eq('id', timeEntryId)
      .eq('company_id', companyId)
      .maybeSingle()

    if (fetchError || !timeEntry) {
      return NextResponse.json({ error: 'Time entry not found' }, { status: 404 })
    }

    if (timeEntry.payroll_run_id) {
      return NextResponse.json({ error: 'Cannot edit time entries already in payroll' }, { status: 400 })
    }

    // Create adjustment record before updating
    const { error: adjustmentError } = await supabase
      .from('time_entry_adjustments')
      .insert({
        time_entry_id: timeEntryId,
        original_clock_in: timeEntry.clock_in_approved_at,
        original_clock_out: timeEntry.clock_out_approved_at,
        new_clock_in: clock_in_approved_at,
        new_clock_out: clock_out_approved_at,
        adjustment_reason: edit_reason || 'Manual adjustment',
        adjusted_by: user.id,
        adjusted_at: new Date().toISOString(),
      })

    if (adjustmentError) {
      console.error('Error creating adjustment record:', adjustmentError)
      // Continue even if adjustment fails - don't block the update
    }

    const { data: updated, error: updateError } = await supabase
      .from('time_entries')
      .update({
        clock_in_approved_at,
        clock_out_approved_at,
        edit_reason: edit_reason || null,
        status: 'approved', // automatically approve when owner edits
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', timeEntryId)
      .eq('company_id', companyId)
      .select('*')
      .single()

    if (updateError) {
      console.error('Error updating time entry:', updateError)
      return NextResponse.json({ error: 'Failed to update time entry' }, { status: 500 })
    }

    return NextResponse.json({ time_entry: updated })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: err.issues }, { status: 422 })
    }
    console.error('Unexpected error updating time entry', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

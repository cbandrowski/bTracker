import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabaseServer'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerClient()
  const { id } = await params

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      clock_in_approved_at,
      clock_out_approved_at,
      adjustment_reason,
    } = body

    if (!adjustment_reason || !adjustment_reason.trim()) {
      return NextResponse.json(
        { error: 'Adjustment reason is required' },
        { status: 400 }
      )
    }

    // Validate that clock_out is after clock_in
    if (clock_in_approved_at && clock_out_approved_at) {
      const clockInDate = new Date(clock_in_approved_at)
      const clockOutDate = new Date(clock_out_approved_at)

      if (clockOutDate <= clockInDate) {
        return NextResponse.json(
          { error: 'Clock out time must be after clock in time' },
          { status: 400 }
        )
      }
    }

    // Get current time entry to record original values
    const { data: currentEntry, error: fetchError } = await supabase
      .from('time_entries')
      .select('clock_in_approved_at, clock_out_approved_at, clock_in_reported_at, clock_out_reported_at')
      .eq('id', id)
      .single()

    if (fetchError || !currentEntry) {
      return NextResponse.json(
        { error: 'Time entry not found' },
        { status: 404 }
      )
    }

    // Record the adjustment in audit table
    const { error: adjustmentError } = await supabase
      .from('time_entry_adjustments')
      .insert({
        time_entry_id: id,
        adjusted_by: user.id,
        original_clock_in: currentEntry.clock_in_approved_at || currentEntry.clock_in_reported_at,
        original_clock_out: currentEntry.clock_out_approved_at || currentEntry.clock_out_reported_at,
        new_clock_in: clock_in_approved_at,
        new_clock_out: clock_out_approved_at,
        adjustment_reason: adjustment_reason,
      })

    if (adjustmentError) {
      console.error('Error creating adjustment record:', adjustmentError)
      return NextResponse.json(
        { error: 'Failed to record adjustment' },
        { status: 500 }
      )
    }

    // Update the time entry
    const updateData: any = {
      edit_reason: adjustment_reason,
      status: 'approved', // Auto-approve when editing
    }

    if (clock_in_approved_at) {
      updateData.clock_in_approved_at = clock_in_approved_at
    }

    if (clock_out_approved_at) {
      updateData.clock_out_approved_at = clock_out_approved_at
    }

    // Set approved_by and approved_at if not already set
    const { data: timeEntry } = await supabase
      .from('time_entries')
      .select('approved_by, approved_at')
      .eq('id', id)
      .single()

    if (!timeEntry?.approved_by) {
      updateData.approved_by = user.id
      updateData.approved_at = new Date().toISOString()
    }

    const { error: updateError } = await supabase
      .from('time_entries')
      .update(updateData)
      .eq('id', id)

    if (updateError) {
      console.error('Error updating time entry:', updateError)
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in time entry update endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * /api/time-entries/[id]/approve
 *
 * POST: Approve a time entry with optional time adjustments
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUser, getUserCompanyIds } from '@/lib/supabaseServer'
import { z } from 'zod'

// Validation schema for approval body
const ApproveTimeEntrySchema = z.object({
  clock_in_approved_at: z.string().datetime().optional(),
  clock_out_approved_at: z.string().datetime().optional(),
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

    // Parse and validate body
    const body = await request.json()
    const validated = ApproveTimeEntrySchema.parse(body)

    // Fetch the time entry to verify it exists and get reported times
    const { data: timeEntry, error: fetchError } = await supabase
      .from('time_entries')
      .select('*')
      .eq('id', timeEntryId)
      .eq('company_id', companyId)
      .single()

    if (fetchError || !timeEntry) {
      return NextResponse.json(
        { error: 'Time entry not found or does not belong to your company' },
        { status: 404 }
      )
    }

    // Check if already approved or rejected
    if (timeEntry.status === 'approved' || timeEntry.status === 'rejected') {
      return NextResponse.json(
        { error: `Time entry has already been ${timeEntry.status}` },
        { status: 400 }
      )
    }

    // Determine approved times
    // If not provided in request, use the reported times
    const clockInApproved = validated.clock_in_approved_at || timeEntry.clock_in_reported_at
    const clockOutApproved = validated.clock_out_approved_at || timeEntry.clock_out_reported_at

    // If there's a clock out time, validate that approved times make sense
    if (timeEntry.clock_out_reported_at && clockOutApproved) {
      if (new Date(clockOutApproved) <= new Date(clockInApproved)) {
        return NextResponse.json(
          { error: 'Clock out time must be after clock in time' },
          { status: 400 }
        )
      }
    }

    // Prepare update data
    const updateData: any = {
      status: 'approved',
      clock_in_approved_at: clockInApproved,
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    }

    // Only set clock_out_approved_at if there's a clock_out time
    if (timeEntry.clock_out_reported_at && clockOutApproved) {
      updateData.clock_out_approved_at = clockOutApproved
    }

    // Add edit reason if provided
    if (validated.edit_reason) {
      updateData.edit_reason = validated.edit_reason
    }

    // Update time entry to approved status
    const { data: updatedEntry, error: updateError } = await supabase
      .from('time_entries')
      .update(updateData)
      .eq('id', timeEntryId)
      .eq('company_id', companyId)
      .select(`
        *,
        employee:company_employees!time_entries_employee_id_fkey(
          id,
          job_title,
          profile:profiles(
            id,
            full_name,
            email
          )
        ),
        approver:profiles!time_entries_approved_by_fkey(
          id,
          full_name,
          email
        )
      `)
      .single()

    if (updateError) {
      console.error('Error approving time entry:', updateError)
      return NextResponse.json({ error: 'Failed to approve time entry' }, { status: 500 })
    }

    return NextResponse.json({
      time_entry: updatedEntry,
      message: 'Time entry approved successfully'
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 422 }
      )
    }
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

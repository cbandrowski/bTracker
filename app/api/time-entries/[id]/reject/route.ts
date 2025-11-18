/**
 * /api/time-entries/[id]/reject
 *
 * POST: Reject a time entry with reason
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUser, getUserCompanyIds } from '@/lib/supabaseServer'
import { z } from 'zod'

// Validation schema for rejection body
const RejectTimeEntrySchema = z.object({
  edit_reason: z.string().min(1, 'Rejection reason is required'),
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
    const validated = RejectTimeEntrySchema.parse(body)

    // Fetch the time entry to verify it exists
    const { data: timeEntry, error: fetchError } = await supabase
      .from('time_entries')
      .select('id, company_id, status')
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

    // Update time entry to rejected status
    const { data: updatedEntry, error: updateError } = await supabase
      .from('time_entries')
      .update({
        status: 'rejected',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        edit_reason: validated.edit_reason,
      })
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
      console.error('Error rejecting time entry:', updateError)
      return NextResponse.json({ error: 'Failed to reject time entry' }, { status: 500 })
    }

    return NextResponse.json({
      time_entry: updatedEntry,
      message: 'Time entry rejected successfully'
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

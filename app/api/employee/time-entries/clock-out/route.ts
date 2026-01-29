/**
 * /api/employee/time-entries/clock-out
 *
 * POST: Employee clocks out from work
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUser } from '@/lib/supabaseServer'
import { getActiveEmployeeRecord, ServiceError } from '@/lib/services/companyContext'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const user = await getCurrentUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { employee } = await getActiveEmployeeRecord(supabase, user.id)

    // Find the currently open time entries (no clock out)
    // Look for entries without clock_out, excluding rejected ones
    console.log('[Clock Out] Looking for open entry for employee:', employee.id)
    const { data: openEntries, error: openError } = await supabase
      .from('time_entries')
      .select('id, clock_in_reported_at, status, created_at')
      .eq('employee_id', employee.id)
      .eq('company_id', employee.company_id)
      .is('clock_out_reported_at', null)
      .neq('status', 'rejected')  // Exclude rejected entries
      .order('clock_in_reported_at', { ascending: false })

    if (openError) {
      console.error('[Clock Out] Error finding open entry:', openError)
      return NextResponse.json({
        error: 'Failed to check clock status',
        details: openError.message
      }, { status: 500 })
    }

    if (!openEntries || openEntries.length === 0) {
      console.log('[Clock Out] No open entry found for employee:', employee.id)
      return NextResponse.json(
        { error: 'Not clocked in - no active time entry found' },
        { status: 400 }
      )
    }

    // If there are multiple open entries (shouldn't happen, but handle it)
    if (openEntries.length > 1) {
      console.warn('[Clock Out] Found multiple open entries:', openEntries.length)
      console.warn('[Clock Out] This indicates duplicate clock-ins. Will close the most recent one.')
    }

    // Use the most recent entry (first in the ordered list)
    const openEntry = openEntries[0]

    console.log('[Clock Out] Found open entry:', {
      id: openEntry.id,
      status: openEntry.status,
      clock_in: openEntry.clock_in_reported_at,
      total_open_entries: openEntries.length
    })

    // Update time entry with clock out
    const now = new Date().toISOString()

    // Determine the new status based on current status
    // When clocking out, always set to pending_approval so owner can review the complete entry
    // Even if clock-in was already approved, the clock-out needs separate approval
    const newStatus = 'pending_approval'

    console.log('[Clock Out] Attempting update:', {
      entry_id: openEntry.id,
      employee_id: employee.id,
      company_id: employee.company_id,
      current_status: openEntry.status,
      new_status: newStatus,
      clock_out_time: now
    })

    const { data: timeEntry, error: updateError } = await supabase
      .from('time_entries')
      .update({
        clock_out_reported_at: now,
        status: newStatus,
        updated_at: now,
      })
      .eq('id', openEntry.id)
      .eq('employee_id', employee.id)
      .eq('company_id', employee.company_id)
      .select()
      .single()

    if (updateError) {
      console.error('[Clock Out] Error updating time entry:', updateError)
      console.error('[Clock Out] Error code:', updateError.code)
      console.error('[Clock Out] Error message:', updateError.message)
      console.error('[Clock Out] Error details:', updateError.details)
      console.error('[Clock Out] Error hint:', updateError.hint)
      console.error('[Clock Out] Full error:', JSON.stringify(updateError, null, 2))
      return NextResponse.json({
        error: 'Failed to clock out',
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint,
        code: updateError.code
      }, { status: 500 })
    }

    console.log('[Clock Out] Successfully updated entry:', timeEntry)

    return NextResponse.json({
      time_entry: timeEntry,
      message: 'Clocked out successfully'
    })
  } catch (error) {
    if (error instanceof ServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

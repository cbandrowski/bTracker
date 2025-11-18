/**
 * /api/employee/time-entries/clock-out
 *
 * POST: Employee clocks out from work
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUser } from '@/lib/supabaseServer'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const user = await getCurrentUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get employee record for this user
    const { data: employee, error: employeeError } = await supabase
      .from('company_employees')
      .select('id, company_id')
      .eq('profile_id', user.id)
      .single()

    if (employeeError || !employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
    }

    // Find the currently open time entry (no clock out)
    const { data: openEntry, error: openError } = await supabase
      .from('time_entries')
      .select('id, clock_in_reported_at')
      .eq('employee_id', employee.id)
      .eq('company_id', employee.company_id)
      .is('clock_out_reported_at', null)
      .maybeSingle()

    if (openError) {
      console.error('Error finding open entry:', openError)
      return NextResponse.json({ error: 'Failed to check clock status' }, { status: 500 })
    }

    if (!openEntry) {
      return NextResponse.json(
        { error: 'Not clocked in - no active time entry found' },
        { status: 400 }
      )
    }

    // Update time entry with clock out
    const { data: timeEntry, error: updateError } = await supabase
      .from('time_entries')
      .update({
        clock_out_reported_at: new Date().toISOString(),
        status: 'pending_approval',
      })
      .eq('id', openEntry.id)
      .eq('employee_id', employee.id)
      .eq('company_id', employee.company_id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating time entry:', updateError)
      return NextResponse.json({ error: 'Failed to clock out' }, { status: 500 })
    }

    return NextResponse.json({
      time_entry: timeEntry,
      message: 'Clocked out successfully'
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

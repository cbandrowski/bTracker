/**
 * /api/employee/time-entries/clock-in
 *
 * POST: Employee clocks in for work
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUser } from '@/lib/supabaseServer'
import { getActiveEmployeeRecord, ServiceError } from '@/lib/services/companyContext'
import { z } from 'zod'

// Optional body schema
const ClockInSchema = z.object({
  schedule_id: z.string().uuid().optional().nullable(),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const user = await getCurrentUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { employee } = await getActiveEmployeeRecord(supabase, user.id)

    // Check if employee already has an open time entry (no clock out, not rejected)
    const { data: openEntries, error: openError } = await supabase
      .from('time_entries')
      .select('id, clock_in_reported_at, status')
      .eq('employee_id', employee.id)
      .eq('company_id', employee.company_id)
      .is('clock_out_reported_at', null)
      .neq('status', 'rejected')

    if (openError) {
      console.error('[Clock In] Error checking open entries:', openError)
      return NextResponse.json({ error: 'Failed to check clock status' }, { status: 500 })
    }

    if (openEntries && openEntries.length > 0) {
      const mostRecent = openEntries[0]
      console.log('[Clock In] Employee already has open entry:', {
        count: openEntries.length,
        most_recent_id: mostRecent.id,
        clock_in: mostRecent.clock_in_reported_at
      })
      return NextResponse.json(
        {
          error: 'Already clocked in',
          clock_in_at: mostRecent.clock_in_reported_at,
          open_entries_count: openEntries.length
        },
        { status: 400 }
      )
    }

    // Parse optional body
    const body = await request.json().catch(() => ({}))
    const validated = ClockInSchema.parse(body)

    // Try to find matching schedule for today if schedule_id not provided
    let scheduleId = validated.schedule_id
    if (!scheduleId) {
      const now = new Date()
      const startOfDay = new Date(now)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(now)
      endOfDay.setHours(23, 59, 59, 999)

      const { data: todaySchedules } = await supabase
        .from('employee_schedules')
        .select('id, start_planned, end_planned')
        .eq('employee_id', employee.id)
        .eq('company_id', employee.company_id)
        .eq('status', 'scheduled')
        .gte('start_planned', startOfDay.toISOString())
        .lte('start_planned', endOfDay.toISOString())
        .order('start_planned', { ascending: true })
        .limit(1)

      if (todaySchedules && todaySchedules.length > 0) {
        scheduleId = todaySchedules[0].id
      }
    }

    // Create new time entry
    const { data: timeEntry, error: insertError } = await supabase
      .from('time_entries')
      .insert({
        company_id: employee.company_id,
        employee_id: employee.id,
        schedule_id: scheduleId,
        clock_in_reported_at: new Date().toISOString(),
        status: 'pending_clock_in',
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating time entry:', insertError)
      return NextResponse.json({ error: 'Failed to clock in' }, { status: 500 })
    }

    return NextResponse.json({
      time_entry: timeEntry,
      message: 'Clocked in successfully'
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 422 }
      )
    }
    if (error instanceof ServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

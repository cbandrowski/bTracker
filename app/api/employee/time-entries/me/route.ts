/**
 * /api/employee/time-entries/me
 *
 * GET: Get employee's own time entries with hours summary
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUser } from '@/lib/supabaseServer'
import { z } from 'zod'
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns'

// Validation schema for query parameters
const GetMyTimeEntriesQuerySchema = z.object({
  view: z.enum(['day', 'week', 'month', 'custom']).optional(),
  from_date: z.string().optional(),
  to_date: z.string().optional(),
})

export async function GET(request: NextRequest) {
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

    // Parse query params
    const { searchParams } = new URL(request.url)
    const query = GetMyTimeEntriesQuerySchema.parse({
      view: searchParams.get('view') as any || undefined,
      from_date: searchParams.get('from_date') || undefined,
      to_date: searchParams.get('to_date') || undefined,
    })

    // Determine date range based on view
    let fromDate: Date
    let toDate: Date

    if (query.view === 'day') {
      fromDate = startOfDay(new Date())
      toDate = endOfDay(new Date())
    } else if (query.view === 'week') {
      fromDate = startOfWeek(new Date(), { weekStartsOn: 0 })
      toDate = endOfWeek(new Date(), { weekStartsOn: 0 })
    } else if (query.view === 'month') {
      fromDate = startOfMonth(new Date())
      toDate = endOfMonth(new Date())
    } else if (query.from_date && query.to_date) {
      fromDate = new Date(query.from_date)
      toDate = new Date(query.to_date)
    } else {
      // Default to current week
      fromDate = startOfWeek(new Date(), { weekStartsOn: 0 })
      toDate = endOfWeek(new Date(), { weekStartsOn: 0 })
    }

    // Fetch time entries (exclude rejected entries)
    const { data, error } = await supabase
      .from('time_entries')
      .select(`
        *,
        schedule:employee_schedules(
          id,
          start_planned,
          end_planned,
          job:jobs(
            id,
            title,
            customer:customers(
              id,
              name
            )
          )
        )
      `)
      .eq('employee_id', employee.id)
      .eq('company_id', employee.company_id)
      .neq('status', 'rejected')
      .gte('clock_in_reported_at', fromDate.toISOString())
      .lte('clock_in_reported_at', toDate.toISOString())
      .order('clock_in_reported_at', { ascending: false })

    if (error) {
      console.error('Error fetching time entries:', error)
      return NextResponse.json({ error: 'Failed to fetch time entries' }, { status: 500 })
    }

    // Calculate total hours (use approved times if available, otherwise reported)
    let totalHours = 0
    const entries = (data || []).map((entry) => {
      let hours = 0

      if (entry.clock_in_approved_at && entry.clock_out_approved_at) {
        // Use approved times
        const start = new Date(entry.clock_in_approved_at)
        const end = new Date(entry.clock_out_approved_at)
        hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
      } else if (entry.clock_in_reported_at && entry.clock_out_reported_at) {
        // Use reported times
        const start = new Date(entry.clock_in_reported_at)
        const end = new Date(entry.clock_out_reported_at)
        hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
      }

      totalHours += hours

      return {
        ...entry,
        computed_hours: hours,
      }
    })

    return NextResponse.json({
      time_entries: entries,
      total_hours: totalHours,
      from_date: fromDate.toISOString(),
      to_date: toDate.toISOString(),
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

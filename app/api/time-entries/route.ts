/**
 * /api/time-entries
 *
 * GET: List time entries with filters (status, date range, employee_id)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUser, getUserCompanyIds } from '@/lib/supabaseServer'
import { z } from 'zod'

// Validation schema for query parameters
const GetTimeEntriesQuerySchema = z.object({
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  employee_id: z.string().uuid().optional(),
  status: z.enum(['pending_clock_in', 'pending_approval', 'approved', 'rejected', 'all']).optional(),
  exclude_payroll: z.enum(['true', 'false']).optional(), // Filter out entries already in payroll
})

export async function GET(request: NextRequest) {
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

    // Parse query params
    const { searchParams } = new URL(request.url)
    const query = GetTimeEntriesQuerySchema.parse({
      start_date: searchParams.get('start_date') || undefined,
      end_date: searchParams.get('end_date') || undefined,
      employee_id: searchParams.get('employee_id') || undefined,
      status: searchParams.get('status') || undefined,
      exclude_payroll: searchParams.get('exclude_payroll') || undefined,
    })

    // Build query - use the v_pending_time_entries view for joined data or base table
    // We'll use base table with manual joins for more flexibility
    let dbQuery = supabase
      .from('time_entries')
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
        ),
        approver:profiles!time_entries_approved_by_fkey(
          id,
          full_name,
          email
        )
      `)
      .eq('company_id', companyId)
      .order('clock_in_reported_at', { ascending: false })

    // Apply filters
    if (query.start_date) {
      dbQuery = dbQuery.gte('clock_in_reported_at', query.start_date)
    }

    if (query.end_date) {
      dbQuery = dbQuery.lte('clock_in_reported_at', query.end_date)
    }

    if (query.employee_id) {
      dbQuery = dbQuery.eq('employee_id', query.employee_id)
    }

    if (query.status) {
      if (query.status === 'all') {
        // 'all' means all PENDING statuses (not approved/rejected)
        dbQuery = dbQuery.in('status', ['pending_clock_in', 'pending_approval'])
      } else {
        dbQuery = dbQuery.eq('status', query.status)
      }
    } else {
      // Default to showing only pending entries if no status specified
      dbQuery = dbQuery.in('status', ['pending_clock_in', 'pending_approval'])
    }

    // Filter out entries already in payroll if requested
    if (query.exclude_payroll === 'true') {
      dbQuery = dbQuery.is('payroll_run_id', null)
    }

    const { data, error } = await dbQuery

    if (error) {
      console.error('Error fetching time entries:', error)
      return NextResponse.json({ error: 'Failed to fetch time entries' }, { status: 500 })
    }

    return NextResponse.json({ time_entries: data || [] })
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

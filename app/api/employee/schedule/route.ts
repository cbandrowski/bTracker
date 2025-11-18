/**
 * /api/employee/schedule
 *
 * GET: List employee's upcoming schedule/shifts
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUser } from '@/lib/supabaseServer'
import { z } from 'zod'

// Validation schema for query parameters
const GetScheduleQuerySchema = z.object({
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
    const query = GetScheduleQuerySchema.parse({
      from_date: searchParams.get('from_date') || undefined,
      to_date: searchParams.get('to_date') || undefined,
    })

    // Build query for employee's schedules
    let dbQuery = supabase
      .from('employee_schedules')
      .select(`
        *,
        job:jobs(
          id,
          title,
          customer:customers(
            id,
            name
          )
        )
      `)
      .eq('employee_id', employee.id)
      .eq('company_id', employee.company_id)
      .in('status', ['scheduled']) // Only show scheduled shifts
      .order('start_planned', { ascending: true })

    // Apply date filters
    if (query.from_date) {
      dbQuery = dbQuery.gte('start_planned', query.from_date)
    }

    if (query.to_date) {
      dbQuery = dbQuery.lte('start_planned', query.to_date)
    }

    const { data, error } = await dbQuery

    if (error) {
      console.error('Error fetching employee schedule:', error)
      return NextResponse.json({ error: 'Failed to fetch schedule' }, { status: 500 })
    }

    return NextResponse.json({ schedules: data || [] })
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

/**
 * /api/employee/payroll
 *
 * GET: Get payroll information for the authenticated employee
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUser } from '@/lib/supabaseServer'
import { getActiveEmployeeRecord, ServiceError } from '@/lib/services/companyContext'

/**
 * GET - Get employee's payroll history
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const user = await getCurrentUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { employee } = await getActiveEmployeeRecord(supabase, user.id)

    // Get all payroll runs that include this employee
    const { data: payrollLines, error: linesError } = await supabase
      .from('payroll_run_lines')
      .select(`
        *,
        payroll_run:payroll_runs(
          id,
          period_start,
          period_end,
          status,
          created_at
        )
      `)
      .eq('employee_id', employee.id)
      .order('created_at', { ascending: false })

    if (linesError) {
      console.error('Error fetching payroll lines:', linesError)
      return NextResponse.json(
        { error: 'Failed to fetch payroll data' },
        { status: 500 }
      )
    }

    // Get current pay period time entries (not yet in a payroll run)
    const { data: currentTimeEntries, error: timeEntriesError } = await supabase
      .from('time_entries')
      .select('*')
      .eq('employee_id', employee.id)
      .eq('status', 'approved')
      .is('payroll_run_id', null)
      .not('clock_out', 'is', null)
      .order('clock_in', { ascending: false })

    if (timeEntriesError) {
      console.error('Error fetching current time entries:', timeEntriesError)
    }

    // Calculate current period totals
    let currentPeriodHours = 0
    let currentPeriodRegularHours = 0
    let currentPeriodOvertimeHours = 0
    let currentPeriodGrossPay = 0

    if (currentTimeEntries && currentTimeEntries.length > 0) {
      currentTimeEntries.forEach(entry => {
        const regular = Number(entry.regular_hours || 0)
        const overtime = Number(entry.overtime_hours || 0)
        const gross = Number(entry.gross_pay || 0)

        currentPeriodRegularHours += regular
        currentPeriodOvertimeHours += overtime
        currentPeriodHours += (regular + overtime)
        currentPeriodGrossPay += gross
      })
    }

    return NextResponse.json({
      employee: {
        id: employee.id,
        job_title: employee.job_title,
        hourly_rate: employee.hourly_rate,
      },
      payroll_history: payrollLines || [],
      current_period: {
        hours: Math.round(currentPeriodHours * 100) / 100,
        regular_hours: Math.round(currentPeriodRegularHours * 100) / 100,
        overtime_hours: Math.round(currentPeriodOvertimeHours * 100) / 100,
        gross_pay: Math.round(currentPeriodGrossPay * 100) / 100,
        time_entries_count: currentTimeEntries?.length || 0,
      },
    })
  } catch (error) {
    if (error instanceof ServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

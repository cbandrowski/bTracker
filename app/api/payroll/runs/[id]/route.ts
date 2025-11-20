/**
 * /api/payroll/runs/[id]
 *
 * GET: Get a single payroll run with its lines
 * DELETE: Delete a draft payroll run
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUser } from '@/lib/supabaseServer'

/**
 * GET - Get a single payroll run with details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient()
    const user = await getCurrentUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: payrollRunId } = await params

    // Fetch payroll run (RLS will ensure user owns this company)
    const { data: payrollRun, error: runError } = await supabase
      .from('payroll_runs')
      .select('*')
      .eq('id', payrollRunId)
      .single()

    if (runError || !payrollRun) {
      return NextResponse.json(
        { error: 'Payroll run not found' },
        { status: 404 }
      )
    }

    // Fetch payroll run lines with employee details
    const { data: lines, error: linesError } = await supabase
      .from('payroll_run_lines')
      .select(`
        *,
        employee:company_employees(
          id,
          hourly_rate,
          profile:profiles(
            id,
            full_name,
            email
          )
        )
      `)
      .eq('payroll_run_id', payrollRunId)

    if (linesError) {
      console.error('Error fetching payroll run lines:', linesError)
      return NextResponse.json(
        { error: 'Failed to fetch payroll run lines' },
        { status: 500 }
      )
    }

    // Optionally fetch time entries included in this run
    const { data: timeEntries, error: entriesError } = await supabase
      .from('time_entries')
      .select(`
        id,
        employee_id,
        clock_in_approved_at,
        clock_out_approved_at,
        regular_hours,
        overtime_hours,
        gross_pay,
        schedule:employee_schedules(
          job:jobs(
            id,
            title,
            customer:customers(name)
          )
        )
      `)
      .eq('payroll_run_id', payrollRunId)
      .order('clock_in_approved_at', { ascending: true })

    if (entriesError) {
      console.error('Error fetching time entries:', entriesError)
    }

    return NextResponse.json({
      payroll_run: payrollRun,
      lines: lines || [],
      time_entries: timeEntries || [],
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Delete a draft payroll run
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient()
    const user = await getCurrentUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: payrollRunId } = await params

    // Fetch the payroll run to check status
    const { data: payrollRun, error: fetchError } = await supabase
      .from('payroll_runs')
      .select('id, status')
      .eq('id', payrollRunId)
      .single()

    if (fetchError || !payrollRun) {
      return NextResponse.json(
        { error: 'Payroll run not found' },
        { status: 404 }
      )
    }

    if (payrollRun.status !== 'draft') {
      return NextResponse.json(
        { error: 'Cannot delete a finalized payroll run' },
        { status: 400 }
      )
    }

    // First, unlink time entries from this payroll run
    await supabase
      .from('time_entries')
      .update({
        payroll_run_id: null,
        regular_hours: null,
        overtime_hours: null,
        gross_pay: null,
      })
      .eq('payroll_run_id', payrollRunId)

    // Delete the payroll run (lines will cascade delete)
    const { error: deleteError } = await supabase
      .from('payroll_runs')
      .delete()
      .eq('id', payrollRunId)

    if (deleteError) {
      console.error('Error deleting payroll run:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete payroll run' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'Payroll run deleted successfully',
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

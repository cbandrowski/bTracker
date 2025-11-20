/**
 * /api/payroll/runs/[id]/finalize
 *
 * POST: Finalize a payroll run (marks as finalized, prevents further changes)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUser } from '@/lib/supabaseServer'
import { finalizePayrollRun } from '@/lib/payroll'

/**
 * POST - Finalize a payroll run
 */
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

    const { id: payrollRunId } = await params

    // Check that the payroll run exists and belongs to the user's company
    const { data: payrollRun, error: fetchError } = await supabase
      .from('payroll_runs')
      .select('id, status, company_id')
      .eq('id', payrollRunId)
      .single()

    if (fetchError || !payrollRun) {
      return NextResponse.json(
        { error: 'Payroll run not found' },
        { status: 404 }
      )
    }

    if (payrollRun.status === 'finalized') {
      return NextResponse.json(
        { error: 'Payroll run is already finalized' },
        { status: 400 }
      )
    }

    // Finalize the run
    await finalizePayrollRun(supabase, payrollRunId)

    console.log('[Payroll] Finalized payroll run:', payrollRunId)

    return NextResponse.json({
      message: 'Payroll run finalized successfully',
      payroll_run_id: payrollRunId,
    })
  } catch (error) {
    console.error('[Payroll] Error finalizing payroll run:', error)

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

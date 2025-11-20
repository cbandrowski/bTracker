/**
 * /api/payroll/runs
 *
 * GET: List payroll runs for the owner's company
 * POST: Create a new payroll run
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUser, getUserCompanyIds } from '@/lib/supabaseServer'
import { z } from 'zod'
import { generatePayrollRun } from '@/lib/payroll'

// Validation schema for creating a payroll run
const CreatePayrollRunSchema = z.object({
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a valid date (YYYY-MM-DD)'),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a valid date (YYYY-MM-DD)'),
})

// Validation schema for query parameters
const ListPayrollRunsQuerySchema = z.object({
  status: z.enum(['draft', 'finalized']).optional(),
  from_date: z.string().optional(),
  to_date: z.string().optional(),
})

/**
 * POST - Create a new payroll run
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const user = await getCurrentUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the owner's company IDs
    const companyIds = await getUserCompanyIds(supabase, user.id)

    if (companyIds.length === 0) {
      return NextResponse.json(
        { error: 'No company found or you are not an owner' },
        { status: 403 }
      )
    }

    // For now, use the first company (most users have one)
    const companyId = companyIds[0]

    // Parse and validate request body
    const body = await request.json()
    const validation = CreatePayrollRunSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.issues },
        { status: 422 }
      )
    }

    const { period_start, period_end } = validation.data

    // Validate date range
    const startDate = new Date(period_start)
    const endDate = new Date(period_end)
    const today = new Date()
    today.setHours(0, 0, 0, 0) // Reset to start of day for comparison

    if (endDate <= startDate) {
      return NextResponse.json(
        { error: 'period_end must be after period_start' },
        { status: 422 }
      )
    }

    // Prevent creating payroll for periods that haven't ended yet
    // The period end date must be before today
    if (endDate >= today) {
      return NextResponse.json(
        {
          error: 'Cannot create payroll for a period that has not ended yet',
          details: 'The period end date must be in the past. Wait until the pay period is complete before running payroll.',
        },
        { status: 422 }
      )
    }

    // Check for overlapping payroll runs
    const { data: existingRuns, error: overlapError } = await supabase
      .from('payroll_runs')
      .select('id, period_start, period_end, status')
      .eq('company_id', companyId)
      .or(
        `and(period_start.lte.${period_end},period_end.gte.${period_start})`
      )

    if (overlapError) {
      console.error('Error checking for overlapping runs:', overlapError)
    }

    if (existingRuns && existingRuns.length > 0) {
      return NextResponse.json(
        {
          error: 'A payroll run already exists for this period or overlaps with it',
          existing_runs: existingRuns,
        },
        { status: 409 }
      )
    }

    // Generate the payroll run
    console.log('[Payroll] Generating payroll run:', {
      company_id: companyId,
      period_start,
      period_end,
      created_by: user.id,
    })

    const result = await generatePayrollRun(
      supabase,
      companyId,
      period_start,
      period_end,
      user.id
    )

    console.log('[Payroll] Successfully created payroll run:', {
      run_id: result.payroll_run.id,
      lines_count: result.lines.length,
      time_entries_count: result.time_entries_count,
      total_gross_pay: result.payroll_run.total_gross_pay,
    })

    return NextResponse.json({
      payroll_run: result.payroll_run,
      lines: result.lines,
      time_entries_count: result.time_entries_count,
      message: 'Payroll run created successfully',
    })
  } catch (error) {
    console.error('[Payroll] Error creating payroll run:', error)

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

/**
 * GET - List payroll runs
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const user = await getCurrentUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the owner's company IDs
    const companyIds = await getUserCompanyIds(supabase, user.id)

    if (companyIds.length === 0) {
      return NextResponse.json(
        { error: 'No company found or you are not an owner' },
        { status: 403 }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const query = ListPayrollRunsQuerySchema.parse({
      status: searchParams.get('status') as any || undefined,
      from_date: searchParams.get('from_date') || undefined,
      to_date: searchParams.get('to_date') || undefined,
    })

    // Build query - support multiple companies
    let dbQuery = supabase
      .from('payroll_runs')
      .select(`
        *,
        lines:payroll_run_lines(count)
      `)
      .in('company_id', companyIds)
      .order('period_start', { ascending: false })

    // Apply filters
    if (query.status) {
      dbQuery = dbQuery.eq('status', query.status)
    }

    if (query.from_date) {
      dbQuery = dbQuery.gte('period_start', query.from_date)
    }

    if (query.to_date) {
      dbQuery = dbQuery.lte('period_end', query.to_date)
    }

    const { data: payrollRuns, error: fetchError } = await dbQuery

    if (fetchError) {
      console.error('Error fetching payroll runs:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch payroll runs' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      payroll_runs: payrollRuns || [],
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 422 }
      )
    }

    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

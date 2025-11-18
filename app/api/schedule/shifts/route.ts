/**
 * /api/schedule/shifts
 *
 * GET: List employee schedules for a date range
 * POST: Create a new shift/schedule
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUser, getUserCompanyIds } from '@/lib/supabaseServer'
import { z } from 'zod'

// Validation schemas
const GetShiftsQuerySchema = z.object({
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  employee_id: z.string().uuid().optional(),
  status: z.enum(['scheduled', 'cancelled', 'completed', 'all']).optional(),
})

const CreateShiftSchema = z.object({
  employee_id: z.string().uuid(),
  job_id: z.string().uuid().optional().nullable(),
  start_planned: z.string().datetime(),
  end_planned: z.string().datetime(),
  notes: z.string().optional().nullable(),
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
    const query = GetShiftsQuerySchema.parse({
      start_date: searchParams.get('start_date') || undefined,
      end_date: searchParams.get('end_date') || undefined,
      employee_id: searchParams.get('employee_id') || undefined,
      status: searchParams.get('status') || undefined,
    })

    // Build query
    let dbQuery = supabase
      .from('v_employee_schedules')
      .select('*')
      .eq('company_id', companyId)
      .order('start_planned', { ascending: true })

    // Apply filters
    if (query.start_date) {
      dbQuery = dbQuery.gte('start_planned', query.start_date)
    }

    if (query.end_date) {
      dbQuery = dbQuery.lte('start_planned', query.end_date)
    }

    if (query.employee_id) {
      dbQuery = dbQuery.eq('employee_id', query.employee_id)
    }

    if (query.status && query.status !== 'all') {
      dbQuery = dbQuery.eq('status', query.status)
    }

    const { data, error } = await dbQuery

    if (error) {
      console.error('Error fetching shifts:', error)
      return NextResponse.json({ error: 'Failed to fetch shifts' }, { status: 500 })
    }

    return NextResponse.json({ shifts: data || [] })
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

export async function POST(request: NextRequest) {
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

    // Parse and validate body
    const body = await request.json()
    const validated = CreateShiftSchema.parse(body)

    // Verify employee belongs to company
    const { data: employee, error: employeeError } = await supabase
      .from('company_employees')
      .select('id')
      .eq('id', validated.employee_id)
      .eq('company_id', companyId)
      .single()

    if (employeeError || !employee) {
      return NextResponse.json(
        { error: 'Employee not found or does not belong to your company' },
        { status: 404 }
      )
    }

    // If job_id provided, verify it belongs to company
    if (validated.job_id) {
      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .select('id')
        .eq('id', validated.job_id)
        .eq('company_id', companyId)
        .single()

      if (jobError || !job) {
        return NextResponse.json(
          { error: 'Job not found or does not belong to your company' },
          { status: 404 }
        )
      }
    }

    // Create shift
    const { data: shift, error: insertError } = await supabase
      .from('employee_schedules')
      .insert({
        company_id: companyId,
        employee_id: validated.employee_id,
        job_id: validated.job_id,
        start_planned: validated.start_planned,
        end_planned: validated.end_planned,
        notes: validated.notes,
        status: 'scheduled',
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating shift:', insertError)
      return NextResponse.json({ error: 'Failed to create shift' }, { status: 500 })
    }

    return NextResponse.json({ shift }, { status: 201 })
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

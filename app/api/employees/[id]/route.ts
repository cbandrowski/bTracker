/**
 * /api/employees/[id]
 *
 * GET: Get a single employee with details
 * PATCH: Update employee details (job title, hourly rate, etc.)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUser, getUserCompanyIds } from '@/lib/supabaseServer'
import { z } from 'zod'

// Validation schema for updating employee
const UpdateEmployeeSchema = z.object({
  job_title: z.string().optional().nullable(),
  hourly_rate: z.number().min(0).optional().nullable(),
  work_status: z.enum(['available', 'inactive', 'vacation', 'sick']).optional(),
  approval_status: z.enum(['pending', 'approved', 'rejected']).optional(),
  department: z.string().optional().nullable(),
})

/**
 * GET - Get a single employee with details
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

    const companyIds = await getUserCompanyIds(supabase, user.id)
    if (companyIds.length === 0) {
      return NextResponse.json({ error: 'No company found' }, { status: 404 })
    }

    const { id: employeeId } = await params

    // Fetch employee with profile
    const { data: employee, error: employeeError } = await supabase
      .from('company_employees')
      .select(`
        *,
        profile:profiles(
          id,
          full_name,
          email,
          phone
        )
      `)
      .eq('id', employeeId)
      .in('company_id', companyIds)
      .single()

    if (employeeError || !employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ employee })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH - Update employee details
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: employeeId } = await params

    // Parse and validate body
    const body = await request.json()
    const validation = UpdateEmployeeSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.issues },
        { status: 422 }
      )
    }

    // Update employee
    const { data: employee, error: updateError } = await supabase
      .from('company_employees')
      .update({
        ...validation.data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', employeeId)
      .in('company_id', companyIds)
      .select(`
        *,
        profile:profiles(
          id,
          full_name,
          email,
          phone
        )
      `)
      .single()

    if (updateError) {
      console.error('Error updating employee:', updateError)
      return NextResponse.json(
        { error: 'Failed to update employee' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      employee,
      message: 'Employee updated successfully',
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

/**
 * /api/employees/[id]
 *
 * GET: Get a single employee with details
 * PATCH: Update employee details (job title, hourly rate, etc.)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUser, getUserCompanyIds } from '@/lib/supabaseServer'
import { getEmployeeWithProfileForOwner, ServiceError, updateEmployeeForOwner } from '@/lib/services/employees'
import { z } from 'zod'

// Validation schema for updating employee
const UpdateEmployeeSchema = z.object({
  job_title: z.string().optional().nullable(),
  hourly_rate: z.number().min(0).optional().nullable(),
  work_status: z.enum(['available', 'inactive', 'vacation', 'sick']).optional(),
  approval_status: z.enum(['pending', 'approved', 'rejected']).optional(),
  department: z.string().optional().nullable(),
})

const EmployeeParamsSchema = z.object({
  id: z.string().uuid(),
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
      return NextResponse.json(
        { error: 'No company found or you are not an owner' },
        { status: 403 }
      )
    }

    const { id: employeeId } = EmployeeParamsSchema.parse(await params)

    const employee = await getEmployeeWithProfileForOwner(
      supabase,
      user.id,
      employeeId
    )

    return NextResponse.json({ employee })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 422 }
      )
    }

    if (error instanceof ServiceError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      )
    }

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
      return NextResponse.json(
        { error: 'No company found or you are not an owner' },
        { status: 403 }
      )
    }

    const { id: employeeId } = EmployeeParamsSchema.parse(await params)

    // Parse and validate body
    const body = await request.json()
    const validation = UpdateEmployeeSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.issues },
        { status: 422 }
      )
    }

    const employee = await updateEmployeeForOwner(
      supabase,
      user.id,
      employeeId,
      validation.data
    )

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

    if (error instanceof ServiceError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      )
    }

    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

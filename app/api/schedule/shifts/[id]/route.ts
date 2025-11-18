/**
 * /api/schedule/shifts/[id]
 *
 * PATCH: Update a shift (time, job, status, notes)
 * DELETE: Cancel a shift (soft delete)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUser, getUserCompanyIds } from '@/lib/supabaseServer'
import { z } from 'zod'

// Validation schema for updating a shift
const UpdateShiftSchema = z.object({
  employee_id: z.string().uuid().optional(),
  job_id: z.string().uuid().optional().nullable(),
  start_planned: z.string().datetime().optional(),
  end_planned: z.string().datetime().optional(),
  status: z.enum(['scheduled', 'cancelled', 'completed']).optional(),
  notes: z.string().optional().nullable(),
})

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

    const companyId = companyIds[0]
    const { id: shiftId } = await params

    // Parse and validate body
    const body = await request.json()
    const validated = UpdateShiftSchema.parse(body)

    // Verify shift exists and belongs to company
    const { data: existingShift, error: fetchError } = await supabase
      .from('employee_schedules')
      .select('id, company_id')
      .eq('id', shiftId)
      .eq('company_id', companyId)
      .single()

    if (fetchError || !existingShift) {
      return NextResponse.json(
        { error: 'Shift not found or does not belong to your company' },
        { status: 404 }
      )
    }

    // If employee_id provided, verify employee belongs to company
    if (validated.employee_id) {
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

    // Update shift
    const { data: shift, error: updateError } = await supabase
      .from('employee_schedules')
      .update(validated)
      .eq('id', shiftId)
      .eq('company_id', companyId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating shift:', updateError)
      return NextResponse.json({ error: 'Failed to update shift' }, { status: 500 })
    }

    return NextResponse.json({ shift })
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

    const companyIds = await getUserCompanyIds(supabase, user.id)
    if (companyIds.length === 0) {
      return NextResponse.json({ error: 'No company found' }, { status: 404 })
    }

    const companyId = companyIds[0]
    const { id: shiftId } = await params

    // Verify shift exists and belongs to company
    const { data: existingShift, error: fetchError } = await supabase
      .from('employee_schedules')
      .select('id, company_id, status')
      .eq('id', shiftId)
      .eq('company_id', companyId)
      .single()

    if (fetchError || !existingShift) {
      return NextResponse.json(
        { error: 'Shift not found or does not belong to your company' },
        { status: 404 }
      )
    }

    // Soft delete by setting status to 'cancelled'
    const { data: shift, error: updateError } = await supabase
      .from('employee_schedules')
      .update({ status: 'cancelled' })
      .eq('id', shiftId)
      .eq('company_id', companyId)
      .select()
      .single()

    if (updateError) {
      console.error('Error cancelling shift:', updateError)
      return NextResponse.json({ error: 'Failed to cancel shift' }, { status: 500 })
    }

    return NextResponse.json({ shift, message: 'Shift cancelled successfully' })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

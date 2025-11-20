/**
 * /api/employees/[id]/availability
 *
 * GET: Get employee availability for all days of week
 * PUT: Update employee availability for all days
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUser, getUserCompanyIds } from '@/lib/supabaseServer'
import { z } from 'zod'

// Validation schema for a single day's availability
const DayAvailabilitySchema = z.object({
  day_of_week: z.number().min(0).max(6),
  is_available: z.boolean(),
  start_time: z.string().nullable(),
  end_time: z.string().nullable(),
}).refine(
  (data) => {
    // If available, must have start and end times
    if (data.is_available) {
      return data.start_time !== null && data.end_time !== null
    }
    // If not available, times should be null
    return data.start_time === null && data.end_time === null
  },
  {
    message: 'When available, start_time and end_time are required. When not available, they should be null.',
  }
)

const UpdateAvailabilitySchema = z.object({
  availability: z.array(DayAvailabilitySchema),
})

/**
 * GET - Get employee availability
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

    // Verify employee belongs to user's company
    const { data: employee } = await supabase
      .from('company_employees')
      .select('id, company_id')
      .eq('id', employeeId)
      .in('company_id', companyIds)
      .single()

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    // Fetch availability
    const { data: availability, error } = await supabase
      .from('employee_availability')
      .select('*')
      .eq('company_employee_id', employeeId)
      .order('day_of_week', { ascending: true })

    if (error) {
      console.error('Error fetching availability:', error)
      return NextResponse.json(
        { error: 'Failed to fetch availability' },
        { status: 500 }
      )
    }

    // If no availability exists, return default (all unavailable)
    if (!availability || availability.length === 0) {
      const defaultAvailability = Array.from({ length: 7 }, (_, i) => ({
        day_of_week: i,
        is_available: false,
        start_time: null,
        end_time: null,
      }))
      return NextResponse.json({ availability: defaultAvailability })
    }

    return NextResponse.json({ availability: availability || [] })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT - Update employee availability
 */
export async function PUT(
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

    // Verify employee belongs to user's company
    const { data: employee } = await supabase
      .from('company_employees')
      .select('id, company_id, profile_id')
      .eq('id', employeeId)
      .in('company_id', companyIds)
      .single()

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    // Check if user is the employee or an owner
    const isEmployee = employee.profile_id === user.id
    const isOwner = companyIds.includes(employee.company_id)

    if (!isEmployee && !isOwner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Parse and validate body
    const body = await request.json()
    const validation = UpdateAvailabilitySchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.issues },
        { status: 422 }
      )
    }

    const { availability } = validation.data

    // Delete existing availability for this employee
    await supabase
      .from('employee_availability')
      .delete()
      .eq('company_employee_id', employeeId)

    // Insert new availability (only for days marked as available)
    const recordsToInsert = availability
      .filter(day => day.is_available)
      .map(day => ({
        company_id: employee.company_id,
        company_employee_id: employeeId,
        day_of_week: day.day_of_week,
        is_available: day.is_available,
        start_time: day.start_time,
        end_time: day.end_time,
      }))

    if (recordsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('employee_availability')
        .insert(recordsToInsert)

      if (insertError) {
        console.error('Error inserting availability:', insertError)
        return NextResponse.json(
          { error: 'Failed to update availability' },
          { status: 500 }
        )
      }
    }

    // Fetch updated availability
    const { data: updatedAvailability } = await supabase
      .from('employee_availability')
      .select('*')
      .eq('company_employee_id', employeeId)
      .order('day_of_week', { ascending: true })

    return NextResponse.json({
      availability: updatedAvailability || [],
      message: 'Availability updated successfully',
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

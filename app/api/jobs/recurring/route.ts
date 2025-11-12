/**
 * POST /api/jobs/recurring - Create recurring jobs
 *
 * Creates multiple job instances based on a recurring pattern.
 * Supports:
 * - Specific days of week (M, T, W, T, F, S, S)
 * - Date-based recurrence (every X days from start date)
 * - End conditions (end of month or specific date)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUser, getUserCompanyIds } from '@/lib/supabaseServer'
import { z } from 'zod'

const RecurringJobSchema = z.object({
  customerId: z.string().uuid(),
  title: z.string().min(1),
  summary: z.string().optional(),
  estimated_amount: z.number().optional(),

  // Recurrence pattern
  recurringType: z.enum(['days_of_week', 'date_interval']),

  // For 'days_of_week' type: array of day numbers (0=Sunday, 1=Monday, etc.)
  daysOfWeek: z.array(z.number().min(0).max(6)).optional(),

  // For 'date_interval' type: interval in days
  intervalDays: z.number().min(1).optional(),

  // Start and end conditions
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endType: z.enum(['end_of_month', 'specific_date']),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const user = await getCurrentUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const companyIds = await getUserCompanyIds(supabase, user.id)
    if (companyIds.length === 0) {
      return NextResponse.json({ error: 'No company found' }, { status: 400 })
    }
    const companyId = companyIds[0]

    const body = await request.json()
    const validated = RecurringJobSchema.parse(body)

    // Verify customer belongs to company
    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('id', validated.customerId)
      .eq('company_id', companyId)
      .single()

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Calculate end date
    const startDate = new Date(validated.startDate)
    let endDate: Date

    if (validated.endType === 'end_of_month') {
      endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0)
    } else if (validated.endType === 'specific_date' && validated.endDate) {
      endDate = new Date(validated.endDate)
    } else {
      return NextResponse.json({ error: 'End date required for specific_date type' }, { status: 400 })
    }

    // Calculate job dates based on recurrence type
    const jobDates: Date[] = []

    if (validated.recurringType === 'days_of_week' && validated.daysOfWeek && validated.daysOfWeek.length > 0) {
      // Create jobs on specific days of week
      let currentDate = new Date(startDate)

      while (currentDate <= endDate) {
        const dayOfWeek = currentDate.getDay()

        if (validated.daysOfWeek.includes(dayOfWeek)) {
          jobDates.push(new Date(currentDate))
        }

        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1)
      }
    } else if (validated.recurringType === 'date_interval' && validated.intervalDays) {
      // Create jobs at regular intervals (e.g., every 7 days)
      let currentDate = new Date(startDate)

      while (currentDate <= endDate) {
        jobDates.push(new Date(currentDate))
        currentDate.setDate(currentDate.getDate() + validated.intervalDays)
      }
    } else {
      return NextResponse.json({
        error: 'Invalid recurrence configuration. Provide daysOfWeek or intervalDays.'
      }, { status: 400 })
    }

    if (jobDates.length === 0) {
      return NextResponse.json({ error: 'No valid dates for recurring jobs' }, { status: 400 })
    }

    // Limit to reasonable number of jobs
    if (jobDates.length > 100) {
      return NextResponse.json({
        error: `Too many jobs (${jobDates.length}). Maximum is 100. Please use a shorter date range.`
      }, { status: 400 })
    }

    // Create job instances
    const jobsToInsert = jobDates.map((date) => ({
      company_id: companyId,
      customer_id: validated.customerId,
      title: `${validated.title} (${date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })})`,
      summary: validated.summary || null,
      status: 'upcoming',
      estimated_amount: validated.estimated_amount || null,
      planned_end_date: date.toISOString().split('T')[0],
    }))

    console.log('Inserting jobs:', JSON.stringify(jobsToInsert[0], null, 2))
    console.log('Total jobs to insert:', jobsToInsert.length)

    const { data: createdJobs, error: jobsError } = await supabase
      .from('jobs')
      .insert(jobsToInsert)
      .select('id, title, planned_end_date, status')

    if (jobsError) {
      console.error('Error creating recurring jobs:', jobsError)
      return NextResponse.json({
        error: 'Failed to create recurring jobs',
        details: jobsError.message,
        hint: jobsError.hint,
        code: jobsError.code
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Created ${createdJobs.length} recurring job instances`,
      jobs: createdJobs,
      count: createdJobs.length,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 })
    }
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

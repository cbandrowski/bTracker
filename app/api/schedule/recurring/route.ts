import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUser, getUserCompanyIds } from '@/lib/supabaseServer'
import { z } from 'zod'
import { createRecurringShifts, ServiceError } from '@/lib/services/schedule'

const RecurringShiftSchema = z.object({
  employee_id: z.string().uuid(),
  start_time: z.string().regex(/^\d{2}:\d{2}$/), // HH:MM format
  end_time: z.string().regex(/^\d{2}:\d{2}$/), // HH:MM format
  days_of_week: z.array(z.number().int().min(0).max(6)).min(1), // 0=Sunday, 6=Saturday
  duration: z.enum(['1week', '2weeks', '3weeks', '4weeks', 'month']),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  company_id: z.string().uuid(),
  notes: z.string().max(500).optional(),
  day_hours: z
    .array(
      z.object({
        day_of_week: z.number().int().min(0).max(6),
        start_time: z.string().regex(/^\d{2}:\d{2}$/),
        end_time: z.string().regex(/^\d{2}:\d{2}$/),
      })
    )
    .optional(),
}).refine(
  (data) => {
    if (!data.day_hours || data.day_hours.length === 0) return true
    const uniqueDays = new Set(data.day_hours.map((d) => d.day_of_week))
    const allDaysValid = data.day_hours.every((d) => data.days_of_week.includes(d.day_of_week))
    return uniqueDays.size === data.day_hours.length && allDaysValid
  },
  {
    message: 'day_hours must match selected days_of_week and contain unique days',
    path: ['day_hours'],
  }
)

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const user = await getCurrentUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = RecurringShiftSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.issues },
        { status: 422 }
      )
    }

    const companyIds = await getUserCompanyIds(supabase, user.id)
    if (!companyIds.includes(parsed.data.company_id)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const shifts = await createRecurringShifts(supabase, user.id, {
      companyId: parsed.data.company_id,
      employeeId: parsed.data.employee_id,
      startTime: parsed.data.start_time,
      endTime: parsed.data.end_time,
      daysOfWeek: parsed.data.days_of_week,
      duration: parsed.data.duration,
      startDate: parsed.data.start_date,
      notes: parsed.data.notes,
      dayHours: parsed.data.day_hours?.map((day) => ({
        dayOfWeek: day.day_of_week,
        startTime: day.start_time,
        endTime: day.end_time,
      })),
    })

    return NextResponse.json(
      {
        success: true,
        count: shifts.length,
        shifts,
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof ServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 422 }
      )
    }

    console.error('Unexpected error creating recurring shifts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * /api/employee-availability/me
 *
 * GET: Return the authenticated employee's availability rows (one per day)
 * PUT: Upsert the seven availability rows for the authenticated employee
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient, getCurrentUser } from '@/lib/supabaseServer'
import { getEmployeeByProfileId } from '@/lib/services/employees'
import {
  EmployeeAvailabilityInput,
  getEmployeeAvailabilityWeek,
  saveEmployeeAvailabilityWeek,
} from '@/lib/services/employeeAvailability'

const timeStringSchema = z
  .string()
  .regex(/^([0-1]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Invalid time format (HH:MM or HH:MM:SS)')

const AvailabilityEntrySchema = z
  .object({
    day_of_week: z.number().int().min(0).max(6),
    is_available: z.boolean(),
    start_time: timeStringSchema.nullable().optional(),
    end_time: timeStringSchema.nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.is_available) {
      if (!value.start_time || !value.end_time) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'start_time and end_time are required when is_available is true',
        })
        return
      }

      if (timeStringToSeconds(value.start_time) >= timeStringToSeconds(value.end_time)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'start_time must be earlier than end_time',
        })
      }
    }
  })

const AvailabilityPayloadSchema = z
  .array(AvailabilityEntrySchema)
  .length(7, { message: 'Availability must include one entry per day' })
  .refine((entries) => {
    const uniqueDays = new Set(entries.map((entry) => entry.day_of_week))
    return uniqueDays.size === entries.length
  }, { message: 'Each day_of_week must appear exactly once' })

function normalizeTimeString(value: string | null | undefined): string | null {
  if (!value) return null
  const [rawHour = '00', rawMinute = '00', rawSecond = '00'] = value.split(':')
  const pad = (part: string) => part.padStart(2, '0')
  return `${pad(rawHour)}:${pad(rawMinute)}:${pad(rawSecond)}`
}

function timeStringToSeconds(value: string): number {
  const [hour = '0', minute = '0', second = '0'] = value.split(':')
  return Number(hour) * 3600 + Number(minute) * 60 + Number(second)
}

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const user = await getCurrentUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const employee = await getEmployeeByProfileId(supabase, user.id)

    if (!employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
    }

    const availability = await getEmployeeAvailabilityWeek(supabase, employee.company_id, employee.id)

    return NextResponse.json({ availability })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 422 })
    }
    console.error('Failed to load employee availability', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const user = await getCurrentUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const employee = await getEmployeeByProfileId(supabase, user.id)

    if (!employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
    }

    const body = await request.json()
    const parsedEntries = AvailabilityPayloadSchema.parse(body)

    const normalizedEntries: EmployeeAvailabilityInput[] = parsedEntries.map((entry) => ({
      day_of_week: entry.day_of_week,
      is_available: entry.is_available,
      start_time: entry.is_available ? normalizeTimeString(entry.start_time) : null,
      end_time: entry.is_available ? normalizeTimeString(entry.end_time) : null,
    }))

    const availability = await saveEmployeeAvailabilityWeek(
      supabase,
      employee.company_id,
      employee.id,
      normalizedEntries
    )

    return NextResponse.json({ availability })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 422 })
    }

    console.error('Failed to save employee availability', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

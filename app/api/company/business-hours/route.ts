import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient, getCurrentUser, getUserCompanyIds } from '@/lib/supabaseServer'
import {
  CompanyBusinessHoursInput,
  getCompanyBusinessHoursWeek,
  saveCompanyBusinessHoursWeek,
} from '@/lib/services/companyBusinessHours'

const timeStringSchema = z
  .string()
  .regex(/^([0-1]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Invalid time format (HH:MM or HH:MM:SS)')

const BusinessHoursEntrySchema = z
  .object({
    day_of_week: z.number().int().min(0).max(6),
    is_open: z.boolean(),
    start_time: timeStringSchema.nullable().optional(),
    end_time: timeStringSchema.nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.is_open) {
      if (!value.start_time || !value.end_time) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'start_time and end_time are required when is_open is true',
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

const BusinessHoursPayloadSchema = z
  .array(BusinessHoursEntrySchema)
  .length(7, { message: 'Business hours must include one entry per day' })
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

    const companyIds = await getUserCompanyIds(supabase, user.id)
    if (companyIds.length === 0) {
      return NextResponse.json({ error: 'No company found' }, { status: 404 })
    }

    const hours = await getCompanyBusinessHoursWeek(supabase, companyIds[0])

    return NextResponse.json({ hours })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 422 })
    }
    console.error('Failed to load business hours', error)
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

    const companyIds = await getUserCompanyIds(supabase, user.id)
    if (companyIds.length === 0) {
      return NextResponse.json({ error: 'No company found' }, { status: 404 })
    }

    const body = await request.json()
    const parsedEntries = BusinessHoursPayloadSchema.parse(body)

    const normalizedEntries: CompanyBusinessHoursInput[] = parsedEntries.map((entry) => ({
      day_of_week: entry.day_of_week,
      is_open: entry.is_open,
      start_time: entry.is_open ? normalizeTimeString(entry.start_time) : null,
      end_time: entry.is_open ? normalizeTimeString(entry.end_time) : null,
    }))

    const hours = await saveCompanyBusinessHoursWeek(
      supabase,
      companyIds[0],
      normalizedEntries
    )

    return NextResponse.json({ hours })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 422 })
    }
    console.error('Failed to save business hours', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

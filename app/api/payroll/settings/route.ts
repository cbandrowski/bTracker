import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient, getCurrentUser, getUserCompanyIds } from '@/lib/supabaseServer'

const SettingsSchema = z.object({
  period_start_day: z.number().int().min(0).max(6),
  period_end_day: z.number().int().min(0).max(6),
  auto_generate: z.boolean().optional(),
})

export async function GET() {
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

    const { data, error } = await supabase
      .from('payroll_settings')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(
      data || {
        company_id: companyId,
        period_start_day: 1,
        period_end_day: 0,
        auto_generate: false,
        last_generated_end_date: null,
      }
    )
  } catch (err) {
    console.error('Payroll settings GET error', err)
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

    const companyId = companyIds[0]
    const body = await request.json()
    const parsed = SettingsSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation error', details: parsed.error.issues }, { status: 422 })
    }

    const payload = {
      company_id: companyId,
      period_start_day: parsed.data.period_start_day,
      period_end_day: parsed.data.period_end_day,
      auto_generate: parsed.data.auto_generate ?? false,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('payroll_settings')
      .upsert(payload, { onConflict: 'company_id' })
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('Payroll settings PUT error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient, getActiveCompanyContext, getCurrentUser, getUserCompanyIds } from '@/lib/supabaseServer'

const SettingsSchema = z.object({
  period_start_day: z.number().int().min(0).max(6),
  period_end_day: z.number().int().min(0).max(6),
  auto_generate: z.boolean().optional(),
})

const CompanyQuerySchema = z.object({
  company_id: z.string().uuid().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const user = await getCurrentUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const query = CompanyQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams)
    )

    const companyIds = await getUserCompanyIds(supabase, user.id)
    if (companyIds.length === 0) {
      return NextResponse.json({ error: 'No company found' }, { status: 404 })
    }

    let companyId = companyIds[0]
    if (query.company_id) {
      if (!companyIds.includes(query.company_id)) {
        return NextResponse.json({ error: 'Unauthorized company access' }, { status: 403 })
      }
      companyId = query.company_id
    } else {
      const context = await getActiveCompanyContext(supabase, user.id)
      if (
        context?.active_role === 'owner' &&
        context.active_company_id &&
        companyIds.includes(context.active_company_id)
      ) {
        companyId = context.active_company_id
      }
    }

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
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: err.issues }, { status: 422 })
    }
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

    const query = CompanyQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams)
    )

    const companyIds = await getUserCompanyIds(supabase, user.id)
    if (companyIds.length === 0) {
      return NextResponse.json({ error: 'No company found' }, { status: 404 })
    }

    let companyId = companyIds[0]
    if (query.company_id) {
      if (!companyIds.includes(query.company_id)) {
        return NextResponse.json({ error: 'Unauthorized company access' }, { status: 403 })
      }
      companyId = query.company_id
    } else {
      const context = await getActiveCompanyContext(supabase, user.id)
      if (
        context?.active_role === 'owner' &&
        context.active_company_id &&
        companyIds.includes(context.active_company_id)
      ) {
        companyId = context.active_company_id
      }
    }
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
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: err.issues }, { status: 422 })
    }
    console.error('Payroll settings PUT error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

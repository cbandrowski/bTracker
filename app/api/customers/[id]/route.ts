import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUser, getUserCompanyIds } from '@/lib/supabaseServer'
import { z } from 'zod'

type CustomerStatus = 'active' | 'archived' | 'all'

const emptyToNull = (val: unknown) => {
  if (typeof val !== 'string') return val
  const trimmed = val.trim()
  return trimmed === '' ? null : trimmed
}

const emptyToUndefined = (val: unknown) => {
  if (typeof val !== 'string') return val
  const trimmed = val.trim()
  return trimmed === '' ? undefined : trimmed
}

const updateCustomerSchema = z.object({
  name: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  phone: z.preprocess(emptyToNull, z.string().nullable().optional()),
  email: z.preprocess(emptyToNull, z.string().email().nullable().optional()),
  billing_address: z.preprocess(emptyToNull, z.string().nullable().optional()),
  billing_address_line_2: z.preprocess(emptyToNull, z.string().nullable().optional()),
  billing_city: z.preprocess(emptyToNull, z.string().nullable().optional()),
  billing_state: z.preprocess(emptyToNull, z.string().nullable().optional()),
  billing_zipcode: z.preprocess(emptyToNull, z.string().nullable().optional()),
  billing_country: z.preprocess(emptyToNull, z.string().nullable().optional()),
  service_address: z.preprocess(emptyToNull, z.string().nullable().optional()),
  service_address_line_2: z.preprocess(emptyToNull, z.string().nullable().optional()),
  service_city: z.preprocess(emptyToNull, z.string().nullable().optional()),
  service_state: z.preprocess(emptyToNull, z.string().nullable().optional()),
  service_zipcode: z.preprocess(emptyToNull, z.string().nullable().optional()),
  service_country: z.preprocess(emptyToNull, z.string().nullable().optional()),
  same_as_billing: z.boolean().optional(),
  notes: z.preprocess(emptyToNull, z.string().nullable().optional()),
  archived: z.boolean().optional(),
})

// GET /api/customers/[id] - Get a single customer
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const searchParams = request.nextUrl.searchParams
    const statusParam = searchParams.get('status')
    const status: CustomerStatus =
      statusParam === 'active' ? 'active' : statusParam === 'archived' ? 'archived' : 'all'
    const supabase = await createServerClient()
    const user = await getCurrentUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const companyIds = await getUserCompanyIds(supabase, user.id)

    let query = supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .in('company_id', companyIds)

    if (status !== 'all') {
      query = query.eq('archived', status === 'archived')
    }

    const { data, error } = await query.single()

    if (error) {
      console.error('Error fetching customer:', error)
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/customers/[id] - Update a customer
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServerClient()
    const user = await getCurrentUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Validate input
    const validationResult = updateCustomerSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation error',
          details: validationResult.error.issues
        },
        { status: 400 }
      )
    }

    const companyIds = await getUserCompanyIds(supabase, user.id)

    // Verify customer belongs to user's company
    const { data: existing } = await supabase
      .from('customers')
      .select('company_id')
      .eq('id', id)
      .single()

    if (!existing || !companyIds.includes(existing.company_id)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const updatePayload = {
      ...validationResult.data,
      updated_at: new Date().toISOString(),
    } as Record<string, any>

    if (typeof validationResult.data.archived !== 'undefined') {
      updatePayload.archived = validationResult.data.archived
      updatePayload.archived_at = validationResult.data.archived
        ? new Date().toISOString()
        : null
    }

    const { data, error } = await supabase
      .from('customers')
      .update(updatePayload)
      .eq('id', id)
      .in('company_id', companyIds)
      .select()
      .single()

    if (error) {
      console.error('Error updating customer:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/customers/[id] - Delete a customer
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServerClient()
    const user = await getCurrentUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const companyIds = await getUserCompanyIds(supabase, user.id)

    // Verify customer belongs to user's company
    const { data: existing } = await supabase
      .from('customers')
      .select('company_id')
      .eq('id', id)
      .single()

    if (!existing || !companyIds.includes(existing.company_id)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { error } = await supabase.from('customers').delete().eq('id', id)

    if (error) {
      console.error('Error deleting customer:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

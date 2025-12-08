import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient, getCurrentUser, getUserCompanyIds } from '@/lib/supabaseServer'

const addressSchema = z.object({
  label: z.string().min(1).max(100),
  address: z.string().max(255).nullable().optional(),
  address_line_2: z.string().max(255).nullable().optional(),
  city: z.string().max(120).nullable().optional(),
  state: z.string().max(120).nullable().optional(),
  zipcode: z.string().max(20).nullable().optional(),
  country: z.string().max(60).nullable().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: customerId } = await params
    const supabase = await createServerClient()
    const user = await getCurrentUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const companyIds = await getUserCompanyIds(supabase, user.id)
    if (companyIds.length === 0) {
      return NextResponse.json({ error: 'No company found' }, { status: 403 })
    }

    // Ensure customer belongs to company
    const { data: customer } = await supabase
      .from('customers')
      .select('company_id')
      .eq('id', customerId)
      .single()

    if (!customer || !companyIds.includes(customer.company_id)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('customer_service_addresses')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: true })

    if (error) {
      throw new Error(error.message)
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Error fetching service addresses:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: customerId } = await params
    const supabase = await createServerClient()
    const user = await getCurrentUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const companyIds = await getUserCompanyIds(supabase, user.id)
    if (companyIds.length === 0) {
      return NextResponse.json({ error: 'No company found' }, { status: 403 })
    }

    const body = await request.json()
    const validated = addressSchema.parse(body)

    // Ensure customer belongs to company to derive company_id
    const { data: customer } = await supabase
      .from('customers')
      .select('company_id')
      .eq('id', customerId)
      .single()

    if (!customer || !companyIds.includes(customer.company_id)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('customer_service_addresses')
      .insert({
        customer_id: customerId,
        company_id: customer.company_id,
        ...validated,
      })
      .select()
      .single()

    if (error) {
      throw new Error(error.message)
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 422 })
    }
    console.error('Error creating service address:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

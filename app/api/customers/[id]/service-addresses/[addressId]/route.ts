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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; addressId: string }> }
) {
  try {
    const { id: customerId, addressId } = await params
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

    // Ensure address belongs to the user's company
    const { data: existing } = await supabase
      .from('customer_service_addresses')
      .select('company_id, customer_id')
      .eq('id', addressId)
      .single()

    if (!existing || existing.customer_id !== customerId || !companyIds.includes(existing.company_id)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('customer_service_addresses')
      .update({
        ...validated,
        updated_at: new Date().toISOString(),
      })
      .eq('id', addressId)
      .eq('customer_id', customerId)
      .select()
      .single()

    if (error) {
      throw new Error(error.message)
    }

    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 422 })
    }
    console.error('Error updating service address:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; addressId: string }> }
) {
  try {
    const { id: customerId, addressId } = await params
    const supabase = await createServerClient()
    const user = await getCurrentUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const companyIds = await getUserCompanyIds(supabase, user.id)
    if (companyIds.length === 0) {
      return NextResponse.json({ error: 'No company found' }, { status: 403 })
    }

    const { data: existing } = await supabase
      .from('customer_service_addresses')
      .select('company_id, customer_id')
      .eq('id', addressId)
      .single()

    if (!existing || existing.customer_id !== customerId || !companyIds.includes(existing.company_id)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { error } = await supabase
      .from('customer_service_addresses')
      .delete()
      .eq('id', addressId)
      .eq('customer_id', customerId)

    if (error) {
      throw new Error(error.message)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting service address:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

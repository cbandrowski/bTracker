import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient, getCurrentUser } from '@/lib/supabaseServer'
import { updateSupplierForOwner, ServiceError } from '@/lib/services/suppliers'

const OptionalText = z.string().trim().optional().nullable()

const SupplierUpdateSchema = z.object({
  label: OptionalText,
  name: z.string().trim().min(1).optional(),
  phone: OptionalText,
  address: OptionalText,
  address_line_2: OptionalText,
  city: OptionalText,
  state: OptionalText,
  zipcode: OptionalText,
  country: OptionalText,
  account_number: OptionalText,
})

// PATCH /api/suppliers/:id - Update a supplier
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const supabase = await createServerClient()
    const user = await getCurrentUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = SupplierUpdateSchema.parse(await request.json())

    const supplier = await updateSupplierForOwner(supabase, user.id, id, body)

    return NextResponse.json(supplier)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 422 }
      )
    }
    if (error instanceof ServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient, getCurrentUser, getUserCompanyIds } from '@/lib/supabaseServer'
import { createSupplierForOwner, listSuppliersForOwner, ServiceError } from '@/lib/services/suppliers'

const OptionalText = z.string().trim().optional().nullable()

const SuppliersQuerySchema = z.object({
  label: z.string().trim().optional(),
  search: z.string().trim().optional(),
})

const SupplierCreateSchema = z.object({
  company_id: z.string().uuid().optional(),
  label: OptionalText,
  name: z.string().trim().min(1),
  phone: OptionalText,
  address: OptionalText,
  address_line_2: OptionalText,
  city: OptionalText,
  state: OptionalText,
  zipcode: OptionalText,
  country: OptionalText,
  account_number: OptionalText,
})

// GET /api/suppliers - List all suppliers for user's companies
export async function GET(request: NextRequest) {
  try {
    const query = SuppliersQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams)
    )

    const supabase = await createServerClient()
    const user = await getCurrentUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const suppliers = await listSuppliersForOwner(supabase, user.id, query)

    return NextResponse.json(suppliers)
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

// POST /api/suppliers - Create a new supplier
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const user = await getCurrentUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = SupplierCreateSchema.parse(await request.json())

    const companyIds = await getUserCompanyIds(supabase, user.id)
    if (companyIds.length === 0) {
      return NextResponse.json({ error: 'No company found for user' }, { status: 400 })
    }

    const companyId = body.company_id ?? companyIds[0]

    const supplier = await createSupplierForOwner(supabase, user.id, {
      company_id: companyId,
      name: body.name,
      label: body.label ?? null,
      phone: body.phone ?? null,
      address: body.address ?? null,
      address_line_2: body.address_line_2 ?? null,
      city: body.city ?? null,
      state: body.state ?? null,
      zipcode: body.zipcode ?? null,
      country: body.country ?? null,
      account_number: body.account_number ?? null,
    })

    return NextResponse.json(supplier, { status: 201 })
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

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient, getCurrentUser, getUserCompanyIds } from '@/lib/supabaseServer'
import {
  createOwnerChangeRequest,
  createOwnerChangeRequestByEmail,
  listOwnerChangeRequests,
  ServiceError,
} from '@/lib/services/owners'

const RequestsQuerySchema = z.object({
  company_id: z.string().uuid().optional(),
})

const CreateRequestSchema = z
  .object({
    action: z.enum(['add_owner', 'remove_owner']),
    target_profile_id: z.string().uuid().optional(),
    target_email: z.string().email().optional(),
    company_id: z.string().uuid().optional(),
  })
  .refine((data) => data.target_profile_id || data.target_email, {
    message: 'Provide target_profile_id or target_email',
  })

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const user = await getCurrentUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const query = RequestsQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams)
    )

    const companyIds = await getUserCompanyIds(supabase, user.id)

    if (companyIds.length === 0) {
      return NextResponse.json({ error: 'No company found' }, { status: 404 })
    }

    const companyId = query.company_id ?? companyIds[0]

    if (!companyIds.includes(companyId)) {
      return NextResponse.json({ error: 'Unauthorized company access' }, { status: 403 })
    }

    const requests = await listOwnerChangeRequests(supabase, user.id, companyId)

    return NextResponse.json({ requests })
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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const user = await getCurrentUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = CreateRequestSchema.parse(body)

    const companyIds = await getUserCompanyIds(supabase, user.id)

    if (companyIds.length === 0) {
      return NextResponse.json({ error: 'No company found' }, { status: 404 })
    }

    const companyId = parsed.company_id ?? companyIds[0]

    if (!companyIds.includes(companyId)) {
      return NextResponse.json({ error: 'Unauthorized company access' }, { status: 403 })
    }

    const requestRecord = parsed.target_email
      ? await createOwnerChangeRequestByEmail(
          supabase,
          user.id,
          companyId,
          parsed.action,
          parsed.target_email.toLowerCase()
        )
      : await createOwnerChangeRequest(
          supabase,
          user.id,
          companyId,
          parsed.action,
          parsed.target_profile_id!
        )

    return NextResponse.json({ request: requestRecord })
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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

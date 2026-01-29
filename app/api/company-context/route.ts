import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient, getCurrentUser } from '@/lib/supabaseServer'
import {
  getActiveContext,
  getMemberships,
  setActiveContext,
  ServiceError,
} from '@/lib/services/companyContext'

const SetContextSchema = z.object({
  company_id: z.string().uuid(),
  role: z.enum(['owner', 'employee']).optional(),
})

export async function GET() {
  try {
    const supabase = await createServerClient()
    const user = await getCurrentUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const memberships = await getMemberships(supabase, user.id)
    const context = await getActiveContext(supabase, user.id)

    return NextResponse.json({ memberships, context })
  } catch (error) {
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
    const parsed = SetContextSchema.parse(body)

    const context = await setActiveContext(
      supabase,
      user.id,
      parsed.company_id,
      parsed.role
    )

    return NextResponse.json({ context })
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

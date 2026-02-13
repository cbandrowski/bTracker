import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient, getCurrentUser } from '@/lib/supabaseServer'
import { rejectOwnerChangeRequest, ServiceError } from '@/lib/services/owners'

const ParamsSchema = z.object({
  id: z.string().uuid(),
})

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient()
    const user = await getCurrentUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = ParamsSchema.parse(await params)

    const { data: requestRow, error: requestError } = await supabase
      .from('owner_change_requests')
      .select('company_id')
      .eq('id', id)
      .maybeSingle()

    if (requestError) {
      return NextResponse.json({ error: requestError.message }, { status: 500 })
    }

    if (!requestRow) {
      return NextResponse.json({ error: 'Owner change request not found' }, { status: 404 })
    }

    const updated = await rejectOwnerChangeRequest(
      supabase,
      user.id,
      requestRow.company_id,
      id
    )

    return NextResponse.json({ request: updated })
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

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient, getCurrentUser } from '@/lib/supabaseServer'
import { rejectApprovalRequest, ServiceError } from '@/lib/services/approvals'

const ParamsSchema = z.object({
  id: z.string().uuid(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = ParamsSchema.parse(await params)
    const supabase = await createServerClient()
    const user = await getCurrentUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const approval = await rejectApprovalRequest(supabase, user.id, id)
    return NextResponse.json({ approval })
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

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabaseServer'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerClient()
  const { id } = await params

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get adjustments with adjusted_by profile
    const { data: adjustments, error } = await supabase
      .from('time_entry_adjustments')
      .select(`
        id,
        original_clock_in,
        original_clock_out,
        new_clock_in,
        new_clock_out,
        adjustment_reason,
        adjusted_at,
        adjusted_by:profiles!time_entry_adjustments_adjusted_by_fkey(full_name)
      `)
      .eq('time_entry_id', id)
      .order('adjusted_at', { ascending: false })

    if (error) {
      console.error('Error fetching adjustments:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ adjustments })
  } catch (error) {
    console.error('Error in adjustments endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

import { NextResponse } from 'next/server'
import { createServerClient, getCurrentUser, getUserCompanyIds } from '@/lib/supabaseServer'

export async function GET() {
  try {
    const supabase = await createServerClient()
    const user = await getCurrentUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const companyIds = await getUserCompanyIds(supabase, user.id)
    if (companyIds.length === 0) {
      return NextResponse.json({ error: 'No company found' }, { status: 404 })
    }

    const companyId = companyIds[0]

    // Fetch company with logo_url
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id, name, logo_url')
      .eq('id', companyId)
      .single()

    if (companyError) {
      return NextResponse.json({ error: 'Failed to fetch company', details: companyError }, { status: 500 })
    }

    // Check if bucket exists
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets()

    // Try to list files in the company folder
    const { data: files, error: filesError } = await supabase.storage
      .from('company_logos')
      .list(companyId)

    return NextResponse.json({
      company,
      bucketExists: buckets?.find(b => b.id === 'company_logos'),
      allBuckets: buckets?.map(b => ({ id: b.id, public: b.public })),
      filesInCompanyFolder: files,
      filesError,
    })
  } catch (error) {
    console.error('Debug error:', error)
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 })
  }
}

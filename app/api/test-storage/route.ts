import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabaseServer'

export async function GET() {
  try {
    const supabase = await createServerClient()

    // List all buckets
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets()

    if (bucketsError) {
      return NextResponse.json({ error: 'Failed to list buckets', details: bucketsError }, { status: 500 })
    }

    // Check if company_logos bucket exists
    const companyLogosBucket = buckets?.find(b => b.id === 'company_logos')

    // Try to list files in the bucket
    let filesInBucket = null
    let filesError = null
    if (companyLogosBucket) {
      const result = await supabase.storage.from('company_logos').list()
      filesInBucket = result.data
      filesError = result.error
    }

    return NextResponse.json({
      buckets: buckets?.map(b => ({ id: b.id, name: b.name, public: b.public })),
      companyLogosBucket,
      filesInBucket,
      filesError,
    })
  } catch (error) {
    console.error('Test storage error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

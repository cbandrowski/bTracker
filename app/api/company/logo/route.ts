/**
 * /api/company/logo
 *
 * POST: Upload company logo to Supabase Storage
 *       Saves public URL to companies.logo_url
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUser, getUserCompanyIds } from '@/lib/supabaseServer'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml']

export async function POST(request: NextRequest) {
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

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: PNG, JPEG, JPG, WEBP, SVG' },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size: 5MB' },
        { status: 400 }
      )
    }

    // Get file extension
    const extension = file.name.split('.').pop() || 'png'
    const fileName = `logo.${extension}`
    const filePath = `${companyId}/${fileName}`

    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()
    const fileBuffer = Buffer.from(arrayBuffer)

    // Upload to Supabase Storage
    console.log('Attempting to upload to:', filePath)
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('company_logos')
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        upsert: true, // Overwrite existing logo
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return NextResponse.json(
        { error: 'Failed to upload file', details: uploadError.message },
        { status: 500 }
      )
    }

    console.log('Upload successful:', uploadData)

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('company_logos')
      .getPublicUrl(filePath)

    const logoUrl = publicUrlData.publicUrl
    console.log('Generated public URL:', logoUrl)

    // Update company record with logo URL
    const { error: updateError } = await supabase
      .from('companies')
      .update({ logo_url: logoUrl })
      .eq('id', companyId)

    if (updateError) {
      console.error('Error updating company logo_url:', updateError)
      return NextResponse.json(
        { error: 'Failed to update company record' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      logo_url: logoUrl,
      message: 'Logo uploaded successfully',
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

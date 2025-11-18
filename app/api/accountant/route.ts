/**
 * /api/accountant
 *
 * GET: Return company + accountant info for the authenticated owner
 * PATCH: Update company fields AND upsert accountant fields
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUser, getUserCompanyIds } from '@/lib/supabaseServer'
import { z } from 'zod'

// Validation schema
const UpdateAccountantSchema = z.object({
  // Company fields
  company: z.object({
    name: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
    phone: z.string().optional(),
    address: z.string().optional(),
    address_line_2: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zipcode: z.string().optional(),
    show_address_on_invoice: z.boolean().optional(),
  }).optional(),

  // Accountant fields
  accountant: z.object({
    accountant_name: z.string().optional(),
    accountant_email: z.string().email().optional().or(z.literal('')),
    accountant_phone: z.string().optional(),
    accountant_address: z.string().optional(),
    accountant_address_line_2: z.string().optional(),
    accountant_city: z.string().optional(),
    accountant_state: z.string().optional(),
    accountant_zipcode: z.string().optional(),
    accountant_country: z.string().optional(),
  }).optional(),
})

export async function GET(request: NextRequest) {
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

    // Fetch company
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single()

    if (companyError) {
      console.error('Error fetching company:', companyError)
      return NextResponse.json({ error: 'Failed to fetch company' }, { status: 500 })
    }

    // Fetch accountant (may not exist)
    const { data: accountant, error: accountantError } = await supabase
      .from('company_accountants')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle()

    if (accountantError) {
      console.error('Error fetching accountant:', accountantError)
      return NextResponse.json({ error: 'Failed to fetch accountant' }, { status: 500 })
    }

    return NextResponse.json({
      company,
      accountant: accountant || null,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
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

    // Parse and validate request body
    const body = await request.json()
    const validated = UpdateAccountantSchema.parse(body)

    // Update company if company fields provided
    if (validated.company) {
      const { error: companyError } = await supabase
        .from('companies')
        .update(validated.company)
        .eq('id', companyId)

      if (companyError) {
        console.error('Error updating company:', companyError)
        return NextResponse.json({ error: 'Failed to update company' }, { status: 500 })
      }
    }

    // Upsert accountant if accountant fields provided
    if (validated.accountant) {
      const accountantData = {
        company_id: companyId,
        ...validated.accountant,
      }

      const { error: accountantError } = await supabase
        .from('company_accountants')
        .upsert(accountantData, {
          onConflict: 'company_id',
        })

      if (accountantError) {
        console.error('Error upserting accountant:', accountantError)
        return NextResponse.json({ error: 'Failed to update accountant' }, { status: 500 })
      }
    }

    // Fetch updated data
    const { data: company } = await supabase
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single()

    const { data: accountant } = await supabase
      .from('company_accountants')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle()

    return NextResponse.json({
      company,
      accountant: accountant || null,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 422 }
      )
    }
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

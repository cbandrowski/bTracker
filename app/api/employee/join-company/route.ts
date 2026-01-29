import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient, getCurrentUser } from '@/lib/supabaseServer'

const JoinCompanySchema = z.object({
  company_code: z.string().min(1),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const user = await getCurrentUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = JoinCompanySchema.parse(body)

    // Find company by code
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id, name')
      .eq('company_code', parsed.company_code.toUpperCase())
      .maybeSingle()

    if (companyError) {
      console.error('Error finding company:', companyError)
      return NextResponse.json({ error: 'Failed to find company' }, { status: 500 })
    }

    if (!company) {
      return NextResponse.json({ error: 'Invalid company code' }, { status: 404 })
    }

    // Check if already a member
    const { data: existingEmployee } = await supabase
      .from('company_employees')
      .select('id')
      .eq('company_id', company.id)
      .eq('profile_id', user.id)
      .maybeSingle()

    if (existingEmployee) {
      return NextResponse.json(
        { error: 'You are already a member of this company' },
        { status: 400 }
      )
    }

    // Create employee relationship
    const { error: employeeError } = await supabase
      .from('company_employees')
      .insert({
        company_id: company.id,
        profile_id: user.id,
        hire_date: new Date().toISOString().split('T')[0],
        job_title: null,
        department: null,
        employment_status: 'active',
        is_manager: false,
        approval_status: 'pending',
      })

    if (employeeError) {
      console.error('Error creating employee:', employeeError)
      return NextResponse.json({ error: 'Failed to join company' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      company: {
        id: company.id,
        name: company.name,
      },
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

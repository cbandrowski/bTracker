// Server-side Supabase client for API routes
import { createServerClient as createSupabaseServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createServerClient() {
  const cookieStore = await cookies()

  return createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

// Get the current user from the session
export async function getCurrentUser(supabase: Awaited<ReturnType<typeof createServerClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  return user
}

export type ActiveCompanyContext = {
  active_company_id: string | null
  active_role: 'owner' | 'employee' | null
}

export async function getActiveCompanyContext(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  userId: string
): Promise<ActiveCompanyContext | null> {
  const { data, error } = await supabase
    .from('profile_company_context')
    .select('active_company_id, active_role')
    .eq('profile_id', userId)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return {
    active_company_id: data.active_company_id ?? null,
    active_role: data.active_role ?? null,
  }
}

// Get the company ID for the current user (owner)
export async function getUserCompanyId(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  userId: string
): Promise<string | null> {
  const companyIds = await getUserCompanyIds(supabase, userId)
  return companyIds[0] || null
}

// Get all company IDs for the current user
export async function getUserCompanyIds(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  userId: string
): Promise<string[]> {
  const { data } = await supabase
    .from('company_owners')
    .select('company_id')
    .eq('profile_id', userId)

  const companyIds = data?.map((d) => d.company_id) || []
  if (companyIds.length === 0) {
    return []
  }

  const context = await getActiveCompanyContext(supabase, userId)
  if (
    context?.active_role === 'owner' &&
    context.active_company_id &&
    companyIds.includes(context.active_company_id)
  ) {
    return [
      context.active_company_id,
      ...companyIds.filter((id) => id !== context.active_company_id),
    ]
  }

  return companyIds
}

export type SupabaseServerClient = Awaited<ReturnType<typeof createServerClient>>

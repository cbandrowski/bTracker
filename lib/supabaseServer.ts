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

// Get the company ID for the current user (owner)
export async function getUserCompanyId(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('company_owners')
    .select('company_id')
    .eq('profile_id', userId)
    .single()

  return data?.company_id || null
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

  return data?.map((d) => d.company_id) || []
}

export type SupabaseServerClient = Awaited<ReturnType<typeof createServerClient>>

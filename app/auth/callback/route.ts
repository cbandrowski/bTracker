import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')
  const error_description = requestUrl.searchParams.get('error_description')

  console.log('🔵 [Callback] Received:', {
    hasCode: !!code,
    error,
    error_description
  })

  // Handle OAuth errors
  if (error) {
    console.error('🔴 [Callback] OAuth error:', error, error_description)
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error_description || error)}`, request.url)
    )
  }

  // No code means this isn't an OAuth callback
  if (!code) {
    console.log('🔴 [Callback] No code provided')
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    const cookieStore = await cookies()

    const supabase = createServerClient(
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
              // Cookie setting might fail in Server Components
            }
          },
        },
      }
    )

    console.log('🔵 [Callback] Exchanging code for session...')
    const { data, error: sessionError } = await supabase.auth.exchangeCodeForSession(code)

    if (sessionError) {
      console.error('🔴 [Callback] Session exchange failed:', sessionError)
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(sessionError.message)}`, request.url)
      )
    }

    if (!data.session) {
      console.error('🔴 [Callback] No session returned')
      return NextResponse.redirect(new URL('/login?error=No session created', request.url))
    }

    console.log('✅ [Callback] Session created for user:', data.user.id)

    // Check if user has a profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', data.user.id)
      .maybeSingle()

    if (profile) {
      console.log('✅ [Callback] Profile exists, redirecting to dashboard')
      return NextResponse.redirect(new URL('/dashboard', request.url))
    } else {
      console.log('🔵 [Callback] No profile, redirecting to onboarding')
      return NextResponse.redirect(new URL('/onboarding', request.url))
    }
  } catch (err: any) {
    console.error('🔴 [Callback] Unexpected error:', err)
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(err.message || 'Authentication failed')}`, request.url)
    )
  }
}

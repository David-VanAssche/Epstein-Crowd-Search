// app/api/auth/callback/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/** Validate redirect target is a safe relative path (no open redirect). */
function safeRedirectPath(next: string | null): string {
  if (!next) return '/'
  // Must start with / and not start with // (protocol-relative URL)
  if (!next.startsWith('/') || next.startsWith('//')) return '/'
  // Block any URL-encoded tricks
  try {
    const decoded = decodeURIComponent(next)
    if (decoded.startsWith('//') || decoded.includes('://')) return '/'
  } catch {
    return '/'
  }
  return next
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeRedirectPath(searchParams.get('next'))

  if (!code) {
    console.error('[Auth Callback] No code parameter in callback URL')
    return NextResponse.redirect(`${origin}/login?error=no_code`)
  }

  const supabase = await createClient()

  // Exchange the code for a session
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('[Auth Callback] Code exchange failed:', error.message)
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  const user = data.user

  if (user) {
    // Upsert profile on login — avoids race condition with concurrent logins
    const displayName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split('@')[0] ||
      'Anonymous Researcher'

    const avatarUrl =
      user.user_metadata?.avatar_url ||
      user.user_metadata?.picture ||
      null

    const { error: profileError } = await supabase
      .from('user_profiles')
      .upsert(
        {
          id: user.id,
          display_name: displayName,
          avatar_url: avatarUrl,
          tier: 'contributor',
          xp: 0,
          level: 1,
          level_title: 'Observer',
        },
        { onConflict: 'id', ignoreDuplicates: true }
      )

    if (profileError) {
      console.error('[Auth Callback] Failed to upsert user profile:', profileError.message)
    }
  }

  return NextResponse.redirect(`${origin}${next}`)
}

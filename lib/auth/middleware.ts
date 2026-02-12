// lib/auth/middleware.ts
import { createClient } from '@/lib/supabase/server'
import { unauthorized, forbidden } from '@/lib/api/responses'

export interface AuthenticatedUser {
  id: string
  email: string | undefined
  user_metadata: Record<string, unknown>
}

/**
 * Extracts the authenticated user from the request.
 * Returns the user if authenticated, null otherwise.
 * Use in API routes that need optional auth.
 */
export async function getUser(): Promise<AuthenticatedUser | null> {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  return {
    id: user.id,
    email: user.email,
    user_metadata: user.user_metadata,
  }
}

/**
 * Requires authentication. Returns the user or a 401 Response
 * that the route handler should return immediately.
 *
 * Usage in route handlers:
 * ```
 * const userOrResponse = await requireAuth()
 * if (userOrResponse instanceof Response) return userOrResponse
 * const user = userOrResponse
 * ```
 */
export async function requireAuth(): Promise<AuthenticatedUser | Response> {
  const user = await getUser()
  if (!user) {
    return unauthorized('You must be signed in to perform this action')
  }
  return user
}

/**
 * Requires a minimum user level/tier.
 * Checks the user_profiles table for tier status.
 */
export async function requireTier(
  minimumTier: 'contributor' | 'researcher' | 'moderator' | 'admin'
): Promise<AuthenticatedUser | Response> {
  const userOrResponse = await requireAuth()
  if (userOrResponse instanceof Response) return userOrResponse

  const user = userOrResponse
  const supabase = await createClient()

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('tier, level')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    console.error('[Auth] Profile lookup failed:', profileError.message)
    return unauthorized('Unable to verify user tier')
  }

  const tierHierarchy: Record<string, number> = {
    contributor: 1,
    researcher: 2,
    moderator: 3,
    admin: 4,
  }

  const userTierLevel = tierHierarchy[profile?.tier || 'contributor'] || 1
  const requiredTierLevel = tierHierarchy[minimumTier] || 1

  if (userTierLevel < requiredTierLevel) {
    return forbidden(`Requires ${minimumTier} tier or higher`)
  }

  return user
}

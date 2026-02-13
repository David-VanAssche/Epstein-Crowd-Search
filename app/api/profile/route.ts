// app/api/profile/route.ts
import { createClient } from '@/lib/supabase/server'
import { success, handleApiError } from '@/lib/api/responses'
import { requireAuth } from '@/lib/auth/middleware'

export async function GET() {
  try {
    const userOrResponse = await requireAuth()
    if (userOrResponse instanceof Response) return userOrResponse
    const user = userOrResponse

    const supabase = await createClient()

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error || !profile) {
      // Return a default profile shape if none exists yet
      return success({
        id: user.id,
        display_name: (user.user_metadata?.full_name as string) ?? user.email?.split('@')[0] ?? 'Researcher',
        avatar_url: (user.user_metadata?.avatar_url as string) ?? null,
        tier: 'contributor',
        level: 1,
        level_title: 'New Researcher',
        xp: 0,
        proposals_submitted: 0,
        proposals_confirmed: 0,
        cascades_triggered: 0,
        accuracy_rate: 0,
        reputation_score: 0,
        current_streak: 0,
        expertise_areas: [],
      })
    }

    return success(profile)
  } catch (err) {
    return handleApiError(err)
  }
}

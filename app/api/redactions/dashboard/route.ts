// app/api/redactions/dashboard/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, handleApiError } from '@/lib/api/responses'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get redaction statistics
    const { data: stats, error: statsError } = await supabase.rpc('get_redaction_stats')

    if (statsError) {
      throw new Error(`Failed to get redaction stats: ${statsError.message}`)
    }

    // Get top contributors (by proposals confirmed)
    const { data: topContributors } = await supabase
      .from('user_profiles')
      .select('id, display_name, avatar_url, proposals_submitted, proposals_confirmed, cascades_triggered, reputation_score, level, level_title')
      .order('proposals_confirmed', { ascending: false })
      .limit(10)

    // Get recent solves
    const { data: recentSolves } = await supabase
      .from('redactions')
      .select(
        `
        id,
        resolved_text,
        resolved_at,
        cascade_count,
        documents ( filename ),
        page_number
      `
      )
      .eq('status', 'confirmed')
      .order('resolved_at', { ascending: false })
      .limit(10)

    return success({
      stats: (stats as any)?.[0] || null,
      top_contributors: topContributors || [],
      recent_solves: recentSolves || [],
    })
  } catch (err) {
    return handleApiError(err)
  }
}

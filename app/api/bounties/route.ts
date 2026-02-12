// app/api/bounties/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { bountyCreateSchema, paginationSchema, parseSearchParams } from '@/lib/api/schemas'
import { success, paginated, handleApiError } from '@/lib/api/responses'
import { requireTier } from '@/lib/auth/middleware'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const queryParams = parseSearchParams(url)
    const pagination = paginationSchema.parse(queryParams)
    const status = url.searchParams.get('status') || 'open'
    const sortBy = url.searchParams.get('sort') || 'xp_reward'

    const supabase = await createClient()
    const offset = (pagination.page - 1) * pagination.per_page

    const { data: bounties, count, error } = await supabase
      .from('research_bounties')
      .select(
        `
        *,
        user_profiles!research_bounties_created_by_fkey ( display_name, avatar_url )
      `,
        { count: 'exact' }
      )
      .eq('status', status)
      .order(sortBy === 'xp_reward' ? 'xp_reward' : 'created_at', { ascending: false })
      .range(offset, offset + pagination.per_page - 1)

    if (error) {
      throw new Error(`Bounties query failed: ${error.message}`)
    }

    const bountiesWithMeta = (bounties || []).map((b: any) => ({
      ...b,
      creator_display_name: b.user_profiles?.display_name,
    }))

    return paginated(bountiesWithMeta, pagination.page, pagination.per_page, count || 0)
  } catch (err) {
    return handleApiError(err)
  }
}

export async function POST(request: NextRequest) {
  try {
    // Require researcher tier to create bounties
    const userOrResponse = await requireTier('researcher')
    if (userOrResponse instanceof Response) return userOrResponse
    const user = userOrResponse

    const body = await request.json()
    const input = bountyCreateSchema.parse(body)

    const supabase = await createClient()

    const { data: bounty, error } = await supabase
      .from('research_bounties')
      .insert({
        created_by: user.id,
        title: input.title,
        description: input.description,
        entity_ids: input.entity_ids,
        target_type: input.target_type,
        xp_reward: input.xp_reward,
        status: 'open',
        expires_at: input.expires_at || null,
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create bounty: ${error.message}`)
    }

    return success(bounty)
  } catch (err) {
    return handleApiError(err)
  }
}

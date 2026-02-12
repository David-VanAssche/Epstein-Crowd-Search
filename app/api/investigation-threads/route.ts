// app/api/investigation-threads/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { threadCreateSchema, paginationSchema, parseSearchParams } from '@/lib/api/schemas'
import { success, paginated, handleApiError } from '@/lib/api/responses'
import { requireAuth } from '@/lib/auth/middleware'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const queryParams = parseSearchParams(url)
    const pagination = paginationSchema.parse(queryParams)
    const status = url.searchParams.get('status') || 'active'
    const tag = url.searchParams.get('tag')

    const supabase = await createClient()
    const offset = (pagination.page - 1) * pagination.per_page

    let query = supabase
      .from('investigation_threads')
      .select(
        `
        *,
        user_profiles ( display_name, avatar_url )
      `,
        { count: 'exact' }
      )
      .eq('is_public', true)
      .eq('status', status)
      .order('updated_at', { ascending: false })
      .range(offset, offset + pagination.per_page - 1)

    if (tag) {
      query = query.contains('tags', [tag])
    }

    const { data: threads, count, error } = await query

    if (error) {
      throw new Error(`Threads query failed: ${error.message}`)
    }

    const threadsWithMeta = (threads || []).map((t: any) => ({
      ...t,
      user_display_name: t.user_profiles?.display_name,
      user_avatar_url: t.user_profiles?.avatar_url,
    }))

    return paginated(threadsWithMeta, pagination.page, pagination.per_page, count || 0)
  } catch (err) {
    return handleApiError(err)
  }
}

export async function POST(request: NextRequest) {
  try {
    const userOrResponse = await requireAuth()
    if (userOrResponse instanceof Response) return userOrResponse
    const user = userOrResponse

    const body = await request.json()
    const input = threadCreateSchema.parse(body)

    const supabase = await createClient()

    const { data: thread, error } = await supabase
      .from('investigation_threads')
      .insert({
        user_id: user.id,
        title: input.title,
        description: input.description || null,
        is_public: input.is_public,
        tags: input.tags,
        status: 'active',
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create thread: ${error.message}`)
    }

    return success(thread)
  } catch (err) {
    return handleApiError(err)
  }
}

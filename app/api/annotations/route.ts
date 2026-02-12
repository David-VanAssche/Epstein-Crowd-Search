// app/api/annotations/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { annotationRequestSchema, parseSearchParams, paginationSchema } from '@/lib/api/schemas'
import { success, paginated, handleApiError } from '@/lib/api/responses'
import { requireAuth } from '@/lib/auth/middleware'
import { checkRateLimit, RATE_LIMITS } from '@/lib/auth/rate-limit'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const documentId = url.searchParams.get('document_id')
    const chunkId = url.searchParams.get('chunk_id')
    const queryParams = parseSearchParams(url)
    const pagination = paginationSchema.parse(queryParams)

    const supabase = await createClient()
    const offset = (pagination.page - 1) * pagination.per_page

    let query = supabase
      .from('annotations')
      .select(
        `
        *,
        user_profiles ( display_name, avatar_url )
      `,
        { count: 'exact' }
      )
      .is('parent_id', null) // Only top-level annotations
      .order('created_at', { ascending: false })
      .range(offset, offset + pagination.per_page - 1)

    if (documentId) {
      query = query.eq('document_id', documentId)
    }
    if (chunkId) {
      query = query.eq('chunk_id', chunkId)
    }

    const { data: annotations, count, error } = await query

    if (error) {
      throw new Error(`Annotations query failed: ${error.message}`)
    }

    // Fetch replies for each annotation
    const annotationIds = (annotations || []).map((a: any) => a.id)
    let replies: any[] = []

    if (annotationIds.length > 0) {
      const { data: replyData } = await supabase
        .from('annotations')
        .select(
          `
          *,
          user_profiles ( display_name, avatar_url )
        `
        )
        .in('parent_id', annotationIds)
        .order('created_at', { ascending: true })

      replies = replyData || []
    }

    // Attach replies to their parent annotations
    const annotationsWithReplies = (annotations || []).map((a: any) => ({
      ...a,
      user_display_name: a.user_profiles?.display_name,
      user_avatar_url: a.user_profiles?.avatar_url,
      replies: replies
        .filter((r: any) => r.parent_id === a.id)
        .map((r: any) => ({
          ...r,
          user_display_name: r.user_profiles?.display_name,
          user_avatar_url: r.user_profiles?.avatar_url,
        })),
    }))

    return paginated(annotationsWithReplies, pagination.page, pagination.per_page, count || 0)
  } catch (err) {
    return handleApiError(err)
  }
}

export async function POST(request: NextRequest) {
  try {
    // Auth required
    const userOrResponse = await requireAuth()
    if (userOrResponse instanceof Response) return userOrResponse
    const user = userOrResponse

    // Rate limiting
    const rateLimitResponse = checkRateLimit(user.id, RATE_LIMITS.annotation)
    if (rateLimitResponse) return rateLimitResponse

    const body = await request.json()
    const input = annotationRequestSchema.parse(body)

    const supabase = await createClient()

    const { data: annotation, error } = await supabase
      .from('annotations')
      .insert({
        user_id: user.id,
        document_id: input.document_id,
        chunk_id: input.chunk_id || null,
        page_number: input.page_number || null,
        content: input.content,
        annotation_type: input.annotation_type,
        parent_id: input.parent_id || null,
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create annotation: ${error.message}`)
    }

    return success(annotation)
  } catch (err) {
    return handleApiError(err)
  }
}

// app/api/annotations/[id]/vote/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, notFound, error, handleApiError } from '@/lib/api/responses'
import { requireAuth } from '@/lib/auth/middleware'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const userOrResponse = await requireAuth()
    if (userOrResponse instanceof Response) return userOrResponse
    const user = userOrResponse

    const { id: annotationId } = await params
    const body = await request.json()
    const voteType = body.vote_type as 'upvote' | 'downvote'

    if (!voteType || !['upvote', 'downvote'].includes(voteType)) {
      return error('vote_type must be "upvote" or "downvote"', 400)
    }

    const supabase = await createClient()

    // Verify annotation exists
    const { data: annotation, error: annotationError } = await supabase
      .from('annotations')
      .select('id, user_id, upvotes, downvotes')
      .eq('id', annotationId)
      .single()

    if (annotationError || !annotation) {
      return notFound('Annotation not found')
    }

    // Prevent self-voting
    if (annotation.user_id === user.id) {
      return error('Cannot vote on your own annotation', 400)
    }

    // Atomic increment to avoid race condition on concurrent votes
    const { data: updated, error: updateError } = await supabase.rpc(
      'increment_annotation_vote',
      {
        p_annotation_id: annotationId,
        p_vote_type: voteType,
      }
    )

    if (updateError) {
      throw new Error(`Failed to update vote: ${updateError.message}`)
    }

    return success(updated)
  } catch (err) {
    return handleApiError(err)
  }
}

// app/api/redaction/[id]/vote/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { voteRequestSchema } from '@/lib/api/schemas'
import { success, notFound, error, handleApiError } from '@/lib/api/responses'
import { requireAuth } from '@/lib/auth/middleware'
import { checkRateLimit, RATE_LIMITS } from '@/lib/auth/rate-limit'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // Auth required
    const userOrResponse = await requireAuth()
    if (userOrResponse instanceof Response) return userOrResponse
    const user = userOrResponse

    // Rate limiting
    const rateLimitResponse = checkRateLimit(user.id, RATE_LIMITS.vote)
    if (rateLimitResponse) return rateLimitResponse

    const { id: redactionId } = await params
    const body = await request.json()
    const input = voteRequestSchema.parse(body)

    const supabase = await createClient()

    // Check redaction status — reject votes on already-resolved redactions
    const { data: redaction, error: redactionError } = await supabase
      .from('redactions')
      .select('id, status')
      .eq('id', redactionId)
      .single()

    if (redactionError || !redaction) {
      return notFound('Redaction not found')
    }

    if (redaction.status === 'confirmed' || redaction.status === 'disputed') {
      return error('This redaction is no longer accepting votes', 400)
    }

    // Verify the proposal exists and belongs to this redaction
    const { data: proposal, error: proposalError } = await supabase
      .from('redaction_proposals')
      .select('id, redaction_id, user_id, upvotes, downvotes, corroborations')
      .eq('id', input.proposal_id)
      .eq('redaction_id', redactionId)
      .single()

    if (proposalError || !proposal) {
      return notFound('Proposal not found for this redaction')
    }

    // Prevent self-voting
    if (proposal.user_id === user.id) {
      return error('Cannot vote on your own proposal', 400)
    }

    // Upsert the vote (unique constraint on proposal_id + user_id)
    const { data: vote, error: voteError } = await supabase
      .from('proposal_votes')
      .upsert(
        {
          proposal_id: input.proposal_id,
          user_id: user.id,
          vote_type: input.vote_type,
        },
        { onConflict: 'proposal_id,user_id' }
      )
      .select()
      .single()

    if (voteError) {
      throw new Error(`Failed to cast vote: ${voteError.message}`)
    }

    // Atomically recalculate vote totals via RPC to avoid race conditions
    const { data: voteTotals } = await supabase.rpc('recalculate_proposal_votes', {
      p_proposal_id: input.proposal_id,
    }) as { data: { upvotes: number; downvotes: number; corroborations: number } | null }

    const upvotes = voteTotals?.upvotes ?? 0
    const downvotes = voteTotals?.downvotes ?? 0
    const corroborations = voteTotals?.corroborations ?? 0

    // Recalculate composite confidence
    await supabase.rpc('calculate_proposal_confidence', {
      target_proposal_id: input.proposal_id,
    })

    // If corroborations >= 3, update redaction status to 'corroborated' via SECURITY DEFINER
    if (corroborations >= 3) {
      await supabase.rpc('transition_redaction_status', {
        p_redaction_id: redactionId,
        p_new_status: 'corroborated',
        p_allowed_from: ['unsolved', 'proposed'],
      })
    }

    // Attempt auto-confirm + cascade via atomic SQL function
    const { data: confirmResult } = await supabase.rpc('auto_confirm_and_cascade', {
      p_proposal_id: input.proposal_id,
      p_redaction_id: redactionId,
      p_system_user_id: process.env.SYSTEM_CASCADE_USER_ID || '00000000-0000-4000-a000-000000000001',
    })

    const autoConfirmData = confirmResult as {
      confirmed?: boolean
      cascade_count?: number
    } | null

    return success({
      vote,
      proposal_votes: { upvotes, downvotes, corroborations },
      auto_confirmed: autoConfirmData?.confirmed ?? false,
      cascade_count: autoConfirmData?.cascade_count ?? 0,
    })
  } catch (err) {
    return handleApiError(err)
  }
}

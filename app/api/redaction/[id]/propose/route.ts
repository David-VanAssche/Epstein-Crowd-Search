// app/api/redaction/[id]/propose/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { proposalRequestSchema } from '@/lib/api/schemas'
import { success, notFound, handleApiError } from '@/lib/api/responses'
import { requireAuth } from '@/lib/auth/middleware'
import { checkRateLimit, RATE_LIMITS } from '@/lib/auth/rate-limit'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id: redactionId } = await params
    const supabase = await createClient()

    const { data: proposals, error } = await supabase
      .from('redaction_proposals')
      .select('*')
      .eq('redaction_id', redactionId)
      .order('composite_confidence', { ascending: false })

    if (error) {
      throw new Error(`Proposals query failed: ${error.message}`)
    }

    return success(proposals || [])
  } catch (err) {
    return handleApiError(err)
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // Auth required
    const userOrResponse = await requireAuth()
    if (userOrResponse instanceof Response) return userOrResponse
    const user = userOrResponse

    // Rate limiting
    const rateLimitResponse = checkRateLimit(user.id, RATE_LIMITS.proposal)
    if (rateLimitResponse) return rateLimitResponse

    const { id: redactionId } = await params
    const body = await request.json()
    const input = proposalRequestSchema.parse(body)

    const supabase = await createClient()

    // Verify the redaction exists
    const { data: redaction, error: redactionError } = await supabase
      .from('redactions')
      .select('id, status, char_length_estimate')
      .eq('id', redactionId)
      .single()

    if (redactionError || !redaction) {
      return notFound('Redaction not found')
    }

    // Check if the proposed text matches the expected character length
    const lengthMatch =
      redaction.char_length_estimate !== null
        ? Math.abs(input.proposed_text.length - (redaction.char_length_estimate as number)) <= 3
        : null

    // Insert the proposal
    const { data: proposal, error: insertError } = await supabase
      .from('redaction_proposals')
      .insert({
        redaction_id: redactionId,
        user_id: user.id,
        proposed_text: input.proposed_text,
        proposed_entity_id: input.proposed_entity_id || null,
        evidence_type: input.evidence_type,
        evidence_description: input.evidence_description,
        evidence_sources: input.evidence_sources,
        supporting_chunk_ids: input.supporting_chunk_ids,
        length_match: lengthMatch,
        status: 'pending',
      })
      .select()
      .single()

    if (insertError) {
      throw new Error(`Failed to create proposal: ${insertError.message}`)
    }

    // Update the redaction status to 'proposed' if it was 'unsolved' (via SECURITY DEFINER)
    if (redaction.status === 'unsolved') {
      await supabase.rpc('transition_redaction_status', {
        p_redaction_id: redactionId,
        p_new_status: 'proposed',
        p_allowed_from: ['unsolved'],
      })
    }

    // Calculate the composite confidence score
    await supabase.rpc('calculate_proposal_confidence', {
      target_proposal_id: proposal.id,
    })

    // Re-fetch the proposal with the computed confidence
    const { data: updatedProposal } = await supabase
      .from('redaction_proposals')
      .select('*')
      .eq('id', proposal.id)
      .single()

    return success(updatedProposal || proposal)
  } catch (err) {
    return handleApiError(err)
  }
}

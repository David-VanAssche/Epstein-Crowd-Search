// lib/pipeline/services/cascade-engine.ts
// When a redaction is solved, find similar unsolved redactions and auto-propose.
// Matching criteria: context similarity > 0.80, char length +/-3, same redaction type.

import { SupabaseClient } from '@supabase/supabase-js'

interface CascadeResult {
  cascadeCount: number
  proposalsCreated: number
  matchedRedactionIds: string[]
}

export async function runCascade(
  solvedRedactionId: string,
  supabase: SupabaseClient
): Promise<CascadeResult> {
  console.log(`[Cascade] Running cascade for redaction ${solvedRedactionId}`)

  // 1. Fetch the solved redaction
  const { data: solved, error } = await supabase
    .from('redactions')
    .select('*')
    .eq('id', solvedRedactionId)
    .eq('status', 'solved')
    .single()

  if (error || !solved) {
    throw new Error(`Solved redaction not found: ${solvedRedactionId}`)
  }

  if (!(solved as any).context_embedding) {
    console.warn('[Cascade] Solved redaction has no context embedding, skipping')
    return { cascadeCount: 0, proposalsCreated: 0, matchedRedactionIds: [] }
  }

  // 2. Find similar unsolved redactions using vector similarity
  let matchedRedactions: any[] = []

  try {
    const { data: matches } = await supabase.rpc('find_similar_redactions', {
      query_embedding: (solved as any).context_embedding,
      similarity_threshold: 0.80,
      match_count: 50,
      redaction_type_filter: (solved as any).redaction_type,
      char_length_min: ((solved as any).char_length_estimate || 10) - 3,
      char_length_max: ((solved as any).char_length_estimate || 10) + 3,
    })

    matchedRedactions = matches || []
  } catch {
    console.warn('[Cascade] find_similar_redactions RPC not available')
    return { cascadeCount: 0, proposalsCreated: 0, matchedRedactionIds: [] }
  }

  // 3. Filter out already-solved and self-references
  const unsolved = matchedRedactions.filter(
    (r: any) => r.id !== solvedRedactionId && r.status === 'unsolved'
  )

  // 4. Create proposals for high-confidence cascades
  let proposalsCreated = 0
  const matchedIds: string[] = []

  for (const match of unsolved) {
    matchedIds.push(match.id)

    const { error: propError } = await supabase.from('redaction_proposals').insert({
      redaction_id: match.id,
      proposed_text: (solved as any).resolved_text,
      proposed_entity_id: (solved as any).resolved_entity_id,
      evidence_type: 'cascade',
      evidence_description: `Auto-cascaded from solved redaction in document. Context similarity: ${match.similarity?.toFixed(2) || 'N/A'}`,
      evidence_sources: [solvedRedactionId],
      context_match_score: match.similarity,
      length_match: true,
      status: 'pending',
    })

    if (!propError) proposalsCreated++

    // Update cascade metadata on the matched redaction
    await supabase
      .from('redactions')
      .update({
        cascade_source_id: solvedRedactionId,
        cascade_depth: ((solved as any).cascade_depth || 0) + 1,
      })
      .eq('id', match.id)
  }

  // 5. Update cascade count on the solved redaction
  await supabase
    .from('redactions')
    .update({ cascade_count: unsolved.length })
    .eq('id', solvedRedactionId)

  console.log(
    `[Cascade] Redaction ${solvedRedactionId}: cascaded to ${unsolved.length} matches, created ${proposalsCreated} proposals`
  )

  return {
    cascadeCount: unsolved.length,
    proposalsCreated,
    matchedRedactionIds: matchedIds,
  }
}

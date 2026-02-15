// lib/pipeline/services/risk-scorer.ts
// Pipeline service: computes per-entity risk scores after document processing.

import { SupabaseClient } from '@supabase/supabase-js'
import type { RiskFactors } from '@/types/entities'

/**
 * Recompute risk scores for all entities mentioned in a specific document.
 * Called after CRIMINAL_INDICATORS + NETWORK_METRICS stages complete.
 */
export async function scoreEntitiesForDocument(
  documentId: string,
  supabase: SupabaseClient
): Promise<number> {
  // Find all distinct entities mentioned in this document
  const { data: mentions, error } = await supabase
    .from('entity_mentions')
    .select('entity_id')
    .eq('document_id', documentId)

  if (error || !mentions) {
    console.warn(`[RiskScorer] Failed to fetch mentions for ${documentId}: ${error?.message}`)
    return 0
  }

  const entityIds = [...new Set(mentions.map((m: any) => m.entity_id))]
  let scored = 0

  for (const entityId of entityIds) {
    try {
      const { error: rpcError } = await supabase.rpc('compute_entity_risk_score', {
        p_entity_id: entityId,
      })

      if (rpcError) {
        console.warn(`[RiskScorer] Failed to score entity ${entityId}: ${rpcError.message}`)
      } else {
        scored++
      }
    } catch (err) {
      console.warn(`[RiskScorer] Error scoring entity ${entityId}:`, err)
    }
  }

  console.log(`[RiskScorer] Document ${documentId}: scored ${scored}/${entityIds.length} entities`)
  return scored
}

/**
 * Batch-recompute risk scores for all entities that have at least one mention.
 * Used for full recomputation (e.g., after migration or bulk import).
 */
export async function scoreAllEntities(
  supabase: SupabaseClient,
  options: { batchSize?: number; onProgress?: (done: number, total: number) => void } = {}
): Promise<number> {
  const { batchSize = 100, onProgress } = options

  // Get all entities with mentions
  const { data: entities, error } = await supabase
    .from('entities')
    .select('id')
    .gt('mention_count', 0)
    .order('mention_count', { ascending: false })

  if (error || !entities) {
    console.error(`[RiskScorer] Failed to fetch entities: ${error?.message}`)
    return 0
  }

  const total = entities.length
  let scored = 0

  for (let i = 0; i < entities.length; i += batchSize) {
    const batch = entities.slice(i, i + batchSize)

    for (const entity of batch) {
      const { error: rpcError } = await supabase.rpc('compute_entity_risk_score', {
        p_entity_id: (entity as any).id,
      })

      if (!rpcError) scored++
    }

    onProgress?.(Math.min(i + batchSize, total), total)
  }

  console.log(`[RiskScorer] Batch complete: scored ${scored}/${total} entities`)
  return scored
}

/**
 * Pipeline stage handler for risk scoring.
 */
export async function handleRiskScore(
  documentId: string,
  supabase: SupabaseClient
): Promise<void> {
  console.log(`[RiskScore] Processing document ${documentId}`)
  await scoreEntitiesForDocument(documentId, supabase)
}

// lib/pipeline/services/entity-merge-detector.ts
// Detects duplicate entities that should be merged using pg_trgm similarity.

import { SupabaseClient } from '@supabase/supabase-js'

export interface MergeCandidate {
  entityA: string
  entityAName: string
  entityB: string
  entityBName: string
  entityType: string
  similarity: number
}

/**
 * Detect potential entity duplicates within the same entity_type
 * using trigram similarity on name_normalized.
 *
 * Requires the pg_trgm extension (already in 00001_extensions.sql).
 */
export async function detectEntityMerges(
  supabase: SupabaseClient,
  options: {
    minSimilarity?: number
    entityType?: string
    limit?: number
  } = {}
): Promise<MergeCandidate[]> {
  const { minSimilarity = 0.85, entityType, limit = 500 } = options

  // Build the similarity query per entity type
  // Uses pg_trgm's % operator and similarity() function
  let query = `
    SELECT
      a.id AS entity_a,
      a.name AS entity_a_name,
      b.id AS entity_b,
      b.name AS entity_b_name,
      a.entity_type,
      similarity(a.name_normalized, b.name_normalized) AS sim
    FROM entities a
    JOIN entities b ON a.entity_type = b.entity_type
      AND a.id < b.id
      AND a.name_normalized % b.name_normalized
    WHERE similarity(a.name_normalized, b.name_normalized) > $1
      AND a.name_normalized IS NOT NULL
      AND b.name_normalized IS NOT NULL
  `

  const params: (number | string)[] = [minSimilarity]

  if (entityType) {
    query += ` AND a.entity_type = $2`
    params.push(entityType)
  }

  query += ` ORDER BY sim DESC LIMIT $${params.length + 1}`
  params.push(limit)

  const { data, error } = await supabase.rpc('exec_sql', {
    sql: query,
    params,
  })

  // Fallback: if exec_sql RPC doesn't exist, query entities and compute in batches
  if (error) {
    return detectEntityMergesFallback(supabase, { minSimilarity, entityType, limit })
  }

  return ((data as any[]) || []).map((row) => ({
    entityA: row.entity_a,
    entityAName: row.entity_a_name,
    entityB: row.entity_b,
    entityBName: row.entity_b_name,
    entityType: row.entity_type,
    similarity: row.sim,
  }))
}

/**
 * Fallback dedup detection that pulls entities client-side
 * and uses Levenshtein distance for name comparison.
 */
async function detectEntityMergesFallback(
  supabase: SupabaseClient,
  options: { minSimilarity: number; entityType?: string; limit: number }
): Promise<MergeCandidate[]> {
  const { minSimilarity, entityType, limit } = options
  const candidates: MergeCandidate[] = []

  let query = supabase
    .from('entities')
    .select('id, name, name_normalized, entity_type')
    .not('name_normalized', 'is', null)
    .order('entity_type')
    .order('name_normalized')

  if (entityType) {
    query = query.eq('entity_type', entityType)
  }

  // Process in batches
  const batchSize = 1000
  let offset = 0
  let allEntities: Array<{ id: string; name: string; name_normalized: string; entity_type: string }> = []

  while (true) {
    const { data: batch } = await query.range(offset, offset + batchSize - 1)
    if (!batch || batch.length === 0) break
    allEntities = allEntities.concat(batch as any[])
    offset += batchSize
    if (batch.length < batchSize) break
  }

  // Group by entity_type
  const byType = new Map<string, typeof allEntities>()
  for (const e of allEntities) {
    const group = byType.get(e.entity_type) || []
    group.push(e)
    byType.set(e.entity_type, group)
  }

  // Compare within each type
  for (const [type, entities] of byType) {
    for (let i = 0; i < entities.length && candidates.length < limit; i++) {
      for (let j = i + 1; j < entities.length && candidates.length < limit; j++) {
        const sim = trigramSimilarity(entities[i].name_normalized, entities[j].name_normalized)
        if (sim >= minSimilarity) {
          candidates.push({
            entityA: entities[i].id,
            entityAName: entities[i].name,
            entityB: entities[j].id,
            entityBName: entities[j].name,
            entityType: type,
            similarity: sim,
          })
        }
      }
    }
  }

  candidates.sort((a, b) => b.similarity - a.similarity)
  return candidates.slice(0, limit)
}

/** Simple trigram similarity implementation (mirrors pg_trgm behavior). */
function trigramSimilarity(a: string, b: string): number {
  const trigramsA = getTrigrams(a)
  const trigramsB = getTrigrams(b)

  let intersection = 0
  const setB = new Set(trigramsB)
  for (const t of trigramsA) {
    if (setB.has(t)) intersection++
  }

  const union = new Set([...trigramsA, ...trigramsB]).size
  return union === 0 ? 0 : intersection / union
}

function getTrigrams(s: string): string[] {
  const padded = `  ${s} `
  const trigrams: string[] = []
  for (let i = 0; i <= padded.length - 3; i++) {
    trigrams.push(padded.slice(i, i + 3))
  }
  return trigrams
}

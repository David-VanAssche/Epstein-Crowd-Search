// lib/pipeline/services/entity-merge-detector.ts
// TODO: Detect duplicate entities that should be merged.
// Uses embedding similarity to find entities with similar names/aliases.

import { SupabaseClient } from '@supabase/supabase-js'

export async function detectEntityMerges(
  _supabase: SupabaseClient
): Promise<Array<{ entityA: string; entityB: string; similarity: number }>> {
  // TODO: Implement entity merge detection
  // 1. Generate embeddings for all entity names + aliases
  // 2. Find pairs with cosine similarity > 0.90
  // 3. Apply heuristics (same type, overlapping aliases)
  // 4. Return merge candidates for human review
  return []
}

// lib/pipeline/services/hint-processor.ts
// TODO: Process user-submitted hints for redaction solving.
// Hints are submitted via the API and processed inline, not in batch.

import { SupabaseClient } from '@supabase/supabase-js'

export async function processHint(
  _hintId: string,
  _supabase: SupabaseClient
): Promise<{ matched: boolean; redactionId?: string; confidence?: number }> {
  // TODO: Implement hint processing
  // 1. Fetch the hint from the database
  // 2. Find redactions matching the hint context
  // 3. Score the hint against each candidate redaction
  // 4. Create a proposal if confidence is high enough
  return { matched: false }
}

// lib/pipeline/services/cascade-engine.ts
// Thin wrapper around the atomic auto_confirm_and_cascade SQL function.
// All logic (locking, threshold checks, batch insert, dedup) lives in the DB.

import { SupabaseClient } from '@supabase/supabase-js'

const SYSTEM_CASCADE_USER_ID =
  process.env.SYSTEM_CASCADE_USER_ID || '00000000-0000-4000-a000-000000000001'

export interface CascadeResult {
  confirmed: boolean
  cascade_count: number
  reason?: string
}

export async function runCascade(
  redactionId: string,
  proposalId: string,
  supabase: SupabaseClient
): Promise<CascadeResult> {
  const { data, error } = await supabase.rpc('auto_confirm_and_cascade', {
    p_proposal_id: proposalId,
    p_redaction_id: redactionId,
    p_system_user_id: SYSTEM_CASCADE_USER_ID,
  })

  if (error) {
    console.error('[Cascade] RPC error:', error.message)
    return { confirmed: false, cascade_count: 0, reason: error.message }
  }

  const result = data as { confirmed: boolean; cascade_count?: number; reason?: string } | null

  return {
    confirmed: result?.confirmed ?? false,
    cascade_count: result?.cascade_count ?? 0,
    reason: result?.reason,
  }
}

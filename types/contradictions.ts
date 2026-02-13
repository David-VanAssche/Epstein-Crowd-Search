// types/contradictions.ts

export interface ContradictionListItem {
  id: string
  claim_a: string
  claim_b: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string | null
  verify_count: number
  dispute_count: number
  is_verified: boolean
  entity_ids: string[]
  tags: string[]
  created_at: string
  creator_display_name: string | null
  claim_a_document_filename: string | null
  claim_b_document_filename: string | null
}

export interface ContradictionDetail extends ContradictionListItem {
  created_by: string | null
  claim_a_chunk_id: string | null
  claim_a_document_id: string | null
  claim_a_page_number: number | null
  claim_b_chunk_id: string | null
  claim_b_document_id: string | null
  claim_b_page_number: number | null
  metadata: Record<string, unknown>
  updated_at: string
  user_vote?: 'verify' | 'dispute' | null
}

export interface ContradictionFiltersState {
  severity: string | null
  isVerified: boolean | null
  entityId: string | null
}

// types/redaction.ts

export type RedactionStatus =
  | 'unsolved'
  | 'proposed'
  | 'corroborated'
  | 'confirmed'
  | 'disputed'

export type RedactionType =
  | 'name'
  | 'date'
  | 'location'
  | 'organization'
  | 'amount'
  | 'unknown'

export type EvidenceType =
  | 'public_statement'
  | 'cross_reference'
  | 'context_deduction'
  | 'document_comparison'
  | 'official_release'
  | 'media_report'
  | 'cascade'
  | 'other'

export type ProposalStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'superseded'

export type VoteType = 'upvote' | 'downvote' | 'corroborate'

export interface Redaction {
  id: string
  document_id: string
  chunk_id: string | null
  page_number: number | null
  redaction_type: RedactionType | null
  char_length_estimate: number | null
  surrounding_text: string
  sentence_template: string | null
  co_occurring_entity_ids: string[]
  document_date: string | null
  document_type: string | null
  position_in_page: { x: number; y: number; width: number; height: number } | null
  status: RedactionStatus
  resolved_text: string | null
  resolved_entity_id: string | null
  confidence: number
  resolved_at: string | null
  resolved_method: string | null
  cascade_source_id: string | null
  cascade_depth: number
  cascade_count: number
  potential_cascade_count: number
  created_at: string
  updated_at: string
}

export interface RedactionProposal {
  id: string
  redaction_id: string
  user_id: string
  proposed_text: string
  proposed_entity_id: string | null
  evidence_type: EvidenceType
  evidence_description: string
  evidence_sources: string[]
  supporting_chunk_ids: string[]
  upvotes: number
  downvotes: number
  corroborations: number
  context_match_score: number | null
  length_match: boolean | null
  entity_graph_consistency: number | null
  composite_confidence: number | null
  status: ProposalStatus
  reviewed_at: string | null
  created_at: string
}

export interface ProposalVote {
  id: string
  proposal_id: string
  user_id: string
  vote_type: VoteType
  created_at: string
}

export interface UserProfile {
  id: string
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  proposals_submitted: number
  proposals_confirmed: number
  cascades_triggered: number
  accuracy_rate: number
  reputation_score: number
  expertise_areas: string[]
  tier: string
  xp: number
  level: number
  level_title: string
  current_streak: number
  longest_streak: number
  last_contribution_date: string | null
  total_cascades_triggered: number
  created_at: string
  updated_at: string
}

export interface RedactionStats {
  total_redactions: number
  unsolved: number
  proposed: number
  corroborated: number
  confirmed: number
  disputed: number
  total_cascades: number
  avg_cascade_depth: number
  total_proposals: number
  total_contributors: number
}

export interface CascadeNode {
  redaction_id: string
  parent_id: string | null
  resolved_text: string | null
  resolved_entity_name: string | null
  document_filename: string
  page_number: number | null
  cascade_depth: number
  resolved_at: string | null
}

export interface SolvableRedaction {
  redaction_id: string
  document_id: string
  document_filename: string
  dataset_name: string | null
  page_number: number | null
  redaction_type: RedactionType | null
  char_length_estimate: number | null
  surrounding_text: string
  sentence_template: string | null
  status: RedactionStatus
  potential_cascade_count: number
  proposal_count: number
  top_proposal_confidence: number | null
}

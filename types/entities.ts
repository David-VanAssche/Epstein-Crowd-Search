// types/entities.ts

import type { PersonCategory } from './structured-data'

export type EntityType =
  | 'person'
  | 'organization'
  | 'location'
  | 'aircraft'
  | 'vessel'
  | 'property'
  | 'account'
  | 'event'
  | 'legal_case'
  | 'government_body'
  | 'trust'
  | 'phone_number'
  | 'vehicle'
  | 'document_reference'

export type MentionType =
  | 'direct'
  | 'indirect'
  | 'implied'
  | 'co_occurrence'

export type RelationshipType =
  | 'traveled_with'
  | 'employed_by'
  | 'associate_of'
  | 'family_member'
  | 'legal_representative'
  | 'financial_connection'
  | 'mentioned_together'
  | 'witness_testimony'
  | 'employer_of'
  | 'guest_of'
  | 'owns'
  | 'controlled_by'
  | 'beneficiary_of'
  | 'investigated_by'
  | 'prosecuted_by'
  | 'victim_of'
  | 'co_defendant'
  | 'introduced_by'
  | 'recruited_by'
  | 'located_at'

export interface RiskFactors {
  evidence_score: number
  relationship_score: number
  indicator_score: number
  top_documents: Array<{ id: string; filename: string; weight: number }>
  contributing_relationships: Array<{ type: string; entity_name: string; weight: number }>
  indicator_categories: Record<string, number>
}

export interface Entity {
  id: string
  name: string
  entity_type: EntityType
  aliases: string[]
  description: string | null
  first_seen_date: string | null
  last_seen_date: string | null
  mention_count: number
  document_count: number
  metadata: Record<string, unknown>
  is_verified: boolean
  created_at: string
  updated_at: string
  // Wikidata enrichment (Phase 11)
  category: PersonCategory | null
  wikidata_id: string | null
  photo_url: string | null
  birth_date: string | null
  death_date: string | null
  nationality: string[]
  occupation: string[]
  // Risk scoring (Phase 27)
  risk_score: number
  risk_factors: RiskFactors
  risk_score_updated_at: string | null
}

export interface EntityMention {
  id: string
  entity_id: string
  chunk_id: string | null
  document_id: string
  video_chunk_id: string | null
  mention_text: string
  context_snippet: string | null
  mention_type: MentionType
  confidence: number
  page_number: number | null
  evidence_weight: number | null
  created_at: string
}

export interface EntityRelationship {
  id: string
  entity_a_id: string
  entity_b_id: string
  relationship_type: RelationshipType
  description: string | null
  evidence_chunk_ids: string[]
  evidence_document_ids: string[]
  date_range: string | null
  strength: number
  is_verified: boolean
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface EntityConnectionNode {
  entity_id: string
  entity_name: string
  entity_type: EntityType
  mention_count: number
  depth: number
  connected_from: string | null
  relationship_type: string | null
  relationship_strength: number | null
}

export interface EntityMentionStats {
  document_id: string
  document_filename: string
  document_classification: string | null
  dataset_name: string | null
  mention_count: number
  mention_types: string[]
  first_mention: string
  last_mention: string
}

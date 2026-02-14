// types/structured-data.ts

export type PersonCategory =
  | 'associate'
  | 'business_leader'
  | 'celebrity'
  | 'diplomat'
  | 'educator'
  | 'intelligence'
  | 'legal'
  | 'media'
  | 'medical'
  | 'military'
  | 'politician'
  | 'royalty'
  | 'staff'
  | 'victim'
  | 'other'
  | 'minor_victim'
  | 'financier'
  | 'religious'
  | 'philanthropist'
  | 'flight_crew'

export type ManifestStatus = 'full' | 'partial' | 'missing'

export type FlightDataSourceType =
  | 'faa_record'
  | 'flight_log'
  | 'deposition'
  | 'media_report'
  | 'court_exhibit'
  | 'other'

export type TransactionType =
  | 'wire_transfer'
  | 'check'
  | 'cash'
  | 'property_purchase'
  | 'donation'
  | 'legal_fee'
  | 'salary'
  | 'investment'
  | 'loan'
  | 'gift'
  | 'other'

export type AcquisitionType =
  | 'purchase'
  | 'gift'
  | 'inheritance'
  | 'trust_transfer'
  | 'corporate_transfer'
  | 'unknown'

export type ContradictionSeverity = 'low' | 'medium' | 'high' | 'critical'

export type OverlapType =
  | 'shared_entity'
  | 'shared_document'
  | 'shared_timeline'
  | 'thematic'
  | 'contradictory'

export interface Email {
  id: string
  document_id: string
  chunk_id: string | null
  extraction_id: string | null
  message_id: string | null
  thread_id: string | null
  in_reply_to: string | null
  subject: string | null
  sent_date: string | null
  from_raw: string | null
  from_entity_id: string | null
  to_raw: string[]
  to_entity_ids: string[]
  cc_raw: string[]
  cc_entity_ids: string[]
  bcc_raw: string[]
  bcc_entity_ids: string[]
  body: string | null
  has_attachments: boolean
  attachment_filenames: string[]
  confidence: number | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  // Joined fields
  from_entity_name?: string
  document_filename?: string
}

export interface FinancialTransaction {
  id: string
  document_id: string
  chunk_id: string | null
  extraction_id: string | null
  from_entity_id: string | null
  from_raw: string | null
  to_entity_id: string | null
  to_raw: string | null
  amount: number | null
  currency: string
  transaction_date: string | null
  transaction_type: TransactionType | null
  description: string | null
  is_suspicious: boolean
  suspicious_reasons: string[]
  shell_company_involved: boolean
  confidence: number | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  // Joined fields
  from_entity_name?: string
  to_entity_name?: string
  document_filename?: string
}

export interface PropertyOwnership {
  id: string
  property_entity_id: string
  owner_entity_id: string
  from_date: string | null
  to_date: string | null
  acquisition_type: AcquisitionType | null
  acquisition_amount: number | null
  shell_company: boolean
  shell_company_name: string | null
  document_ids: string[]
  notes: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  // Joined fields
  property_name?: string
  owner_name?: string
}

export interface Contradiction {
  id: string
  created_by: string | null
  claim_a: string
  claim_a_chunk_id: string | null
  claim_a_document_id: string | null
  claim_a_page_number: number | null
  claim_b: string
  claim_b_chunk_id: string | null
  claim_b_document_id: string | null
  claim_b_page_number: number | null
  severity: ContradictionSeverity
  description: string | null
  entity_ids: string[]
  tags: string[]
  verify_count: number
  dispute_count: number
  is_verified: boolean
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  // Joined fields
  claim_a_document_filename?: string
  claim_b_document_filename?: string
  creator_display_name?: string
}

export interface ThreadConvergence {
  id: string
  thread_a_id: string
  thread_b_id: string
  created_by: string | null
  overlap_type: OverlapType
  description: string | null
  shared_entity_ids: string[]
  created_at: string
  // Joined fields
  thread_a_title?: string
  thread_b_title?: string
}

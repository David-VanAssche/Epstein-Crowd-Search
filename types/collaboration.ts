// types/collaboration.ts

export type AnnotationType =
  | 'question'
  | 'observation'
  | 'correction'
  | 'connection'

export type ThreadStatus = 'active' | 'completed' | 'archived'

export type ThreadItemType =
  | 'document'
  | 'entity'
  | 'timeline_event'
  | 'annotation'
  | 'note'
  | 'image'

export type OCRCorrectionStatus = 'pending' | 'approved' | 'rejected'

export type ReviewType =
  | 'ocr_verified'
  | 'entities_confirmed'
  | 'dates_validated'
  | 'redactions_attempted'
  | 'cross_references_checked'

export type BountyTargetType = 'entity' | 'redaction' | 'question' | 'pattern'

export type BountyStatus = 'open' | 'claimed' | 'completed' | 'expired'

export type NotificationType =
  | 'proposal_update'
  | 'annotation_reply'
  | 'search_alert'
  | 'achievement'
  | 'bounty'
  | 'system'

export type AlertFrequency = 'immediate' | 'daily' | 'weekly'

export type FactStatus = 'proposed' | 'verified' | 'disputed' | 'retracted'

export type ExtractionType =
  | 'flight_manifest'
  | 'financial_record'
  | 'phone_record'
  | 'address_book_entry'

export interface Annotation {
  id: string
  user_id: string
  document_id: string
  chunk_id: string | null
  page_number: number | null
  content: string
  annotation_type: AnnotationType
  parent_id: string | null
  upvotes: number
  downvotes: number
  created_at: string
  updated_at: string
  // Joined fields
  user_display_name?: string
  user_avatar_url?: string
  replies?: Annotation[]
}

export interface InvestigationThread {
  id: string
  user_id: string
  title: string
  description: string | null
  status: ThreadStatus
  is_public: boolean
  follower_count: number
  fork_source_id: string | null
  conclusion_summary: string | null
  tags: string[]
  created_at: string
  updated_at: string
  // Joined fields
  user_display_name?: string
  user_avatar_url?: string
  item_count?: number
}

export interface InvestigationThreadItem {
  id: string
  thread_id: string
  user_id: string
  item_type: ThreadItemType
  target_id: string | null
  position: number
  note: string | null
  created_at: string
}

export interface OCRCorrection {
  id: string
  user_id: string
  chunk_id: string | null
  document_id: string
  page_number: number | null
  original_text: string
  corrected_text: string
  status: OCRCorrectionStatus
  reviewed_by: string | null
  created_at: string
}

export interface DocumentReview {
  id: string
  document_id: string
  user_id: string
  review_type: ReviewType
  notes: string | null
  created_at: string
}

export interface ResearchBounty {
  id: string
  created_by: string
  title: string
  description: string
  entity_ids: string[]
  target_type: BountyTargetType
  xp_reward: number
  status: BountyStatus
  claimed_by: string | null
  completed_at: string | null
  expires_at: string | null
  created_at: string
  // Joined fields
  creator_display_name?: string
}

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  message: string | null
  link: string | null
  is_read: boolean
  created_at: string
}

export interface SavedSearchAlert {
  id: string
  user_id: string
  saved_search_id: string
  is_active: boolean
  frequency: AlertFrequency
  last_notified_at: string | null
  new_results_count: number
  created_at: string
}

export interface Fact {
  id: string
  fact_text: string
  confidence: number
  entity_ids: string[]
  supporting_chunk_ids: string[]
  supporting_document_ids: string[]
  verified_by: string[]
  verification_count: number
  counter_evidence_count: number
  status: FactStatus
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface AudioFile {
  id: string
  document_id: string | null
  dataset_id: string | null
  filename: string
  storage_path: string
  duration_seconds: number | null
  transcript: string | null
  transcript_language: string
  file_type: string | null
  file_size_bytes: number | null
  processing_status: string
  metadata: Record<string, unknown>
  created_at: string
}

export interface AudioChunk {
  id: string
  audio_id: string
  chunk_index: number
  content: string
  timestamp_start: number | null
  timestamp_end: number | null
  speaker_label: string | null
  created_at: string
}

export interface PinboardBoard {
  id: string
  user_id: string
  title: string
  description: string | null
  is_public: boolean
  board_data: {
    pins: PinboardPin[]
    connections: PinboardConnection[]
  }
  created_at: string
  updated_at: string
}

export interface PinboardPin {
  id: string
  type: 'document' | 'entity' | 'image' | 'timeline_event' | 'note'
  target_id?: string
  label: string
  note?: string
  x: number
  y: number
}

export interface PinboardConnection {
  id: string
  from_pin_id: string
  to_pin_id: string
  label?: string
}

export interface StructuredDataExtraction {
  id: string
  document_id: string
  chunk_id: string | null
  extraction_type: ExtractionType
  extracted_data: Record<string, unknown>
  confidence: number | null
  verified_by: string | null
  created_at: string
}

// Corpus stats from materialized view
export interface CorpusStats {
  total_documents: number
  processed_documents: number
  total_pages: number | null
  total_chunks: number
  total_images: number
  total_videos: number
  total_entities: number
  total_relationships: number
  total_redactions: number
  solved_redactions: number
  corroborated_redactions: number
  total_proposals: number
  total_contributors: number
}

// Funding types
export interface FundingStatus {
  id: string
  gofundme_url: string | null
  goal_amount: number
  raised_amount: number
  donor_count: number
  last_synced_at: string
  updated_at: string
}

export interface SpendLogEntry {
  id: string
  amount: number
  service: string
  description: string
  pages_processed: number | null
  chunks_created: number | null
  entities_extracted: number | null
  redactions_detected: number | null
  images_processed: number | null
  dataset_id: string | null
  triggered_by: string | null
  created_at: string
}

export interface DonationImpactTier {
  id: string
  amount: number
  label: string
  description: string
  pages_processed: number | null
  entities_extracted: number | null
  analogy: string | null
  sort_order: number
}

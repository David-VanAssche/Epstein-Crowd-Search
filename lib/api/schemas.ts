// lib/api/schemas.ts
import { z } from 'zod'

// --- Search ---
export const searchRequestSchema = z.object({
  query: z.string().min(1, 'Query is required').max(500, 'Query too long'),
  filters: z
    .object({
      dataset_id: z.string().uuid().optional(),
      doc_type: z.string().optional(),
      date_from: z.string().datetime().optional(),
      date_to: z.string().datetime().optional(),
      entity_id: z.string().uuid().optional(),
      has_redactions: z.boolean().optional(),
    })
    .optional(),
  page: z.number().int().min(1).default(1),
  per_page: z.number().int().min(1).max(100).default(20),
  sort: z.enum(['relevance', 'date_asc', 'date_desc', 'mentions']).default('relevance'),
})

export type SearchRequestInput = z.infer<typeof searchRequestSchema>

export const multimodalSearchRequestSchema = z.object({
  query: z.string().min(1).max(500),
  modalities: z
    .object({
      documents: z.boolean().default(true),
      images: z.boolean().default(true),
      videos: z.boolean().default(true),
    })
    .default({ documents: true, images: true, videos: true }),
  filters: z
    .object({
      dataset_id: z.string().uuid().optional(),
    })
    .optional(),
  page: z.number().int().min(1).default(1),
  per_page: z.number().int().min(1).max(100).default(20),
})

export type MultimodalSearchRequestInput = z.infer<typeof multimodalSearchRequestSchema>

// --- Chat ---
export const chatRequestSchema = z.object({
  message: z.string().min(1, 'Message is required').max(4000, 'Message too long'),
  conversation_id: z.string().uuid().optional(),
  session_id: z.string().min(1),
  model_tier: z.enum(['free', 'researcher', 'pro']).default('free'),
})

export type ChatRequestInput = z.infer<typeof chatRequestSchema>

// --- Redaction Proposal ---
export const proposalRequestSchema = z.object({
  proposed_text: z.string().min(1, 'Proposed text is required').max(1000),
  proposed_entity_id: z.string().uuid().optional(),
  evidence_type: z.enum([
    'public_statement',
    'cross_reference',
    'context_deduction',
    'document_comparison',
    'official_release',
    'media_report',
    'other',
  ]),
  evidence_description: z.string().min(10, 'Please provide a detailed description').max(5000),
  evidence_sources: z.array(z.string().max(2000)).max(10).default([]),
  supporting_chunk_ids: z.array(z.string().uuid()).max(20).default([]),
})

export type ProposalRequestInput = z.infer<typeof proposalRequestSchema>

// --- Vote ---
export const voteRequestSchema = z.object({
  proposal_id: z.string().uuid(),
  vote_type: z.enum(['upvote', 'downvote', 'corroborate']),
})

export type VoteRequestInput = z.infer<typeof voteRequestSchema>

// --- Timeline ---
export const timelineQuerySchema = z.object({
  entity_id: z.string().uuid().optional(),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
  event_type: z.string().optional(),
  page: z.number().int().min(1).default(1),
  per_page: z.number().int().min(1).max(100).default(50),
})

export type TimelineQueryInput = z.infer<typeof timelineQuerySchema>

// --- Annotation ---
export const annotationRequestSchema = z.object({
  document_id: z.string().uuid(),
  chunk_id: z.string().uuid().optional(),
  page_number: z.number().int().min(1).optional(),
  content: z.string().min(1).max(5000),
  annotation_type: z.enum(['question', 'observation', 'correction', 'connection']).default('observation'),
  parent_id: z.string().uuid().optional(),
})

export type AnnotationRequestInput = z.infer<typeof annotationRequestSchema>

// --- Investigation Thread ---
export const threadCreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  is_public: z.boolean().default(true),
  tags: z.array(z.string().max(50)).max(10).default([]),
})

export type ThreadCreateInput = z.infer<typeof threadCreateSchema>

export const threadItemSchema = z.object({
  item_type: z.enum(['document', 'entity', 'timeline_event', 'annotation', 'note', 'image']),
  target_id: z.string().uuid().optional(),
  note: z.string().max(5000).optional(),
})

export type ThreadItemInput = z.infer<typeof threadItemSchema>

// --- OCR Correction ---
export const ocrCorrectionSchema = z.object({
  document_id: z.string().uuid(),
  chunk_id: z.string().uuid().optional(),
  page_number: z.number().int().min(1).optional(),
  original_text: z.string().min(1).max(10000),
  corrected_text: z.string().min(1).max(10000),
})

export type OCRCorrectionInput = z.infer<typeof ocrCorrectionSchema>

// --- Bounty ---
export const bountyCreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(10).max(5000),
  entity_ids: z.array(z.string().uuid()).max(10).default([]),
  target_type: z.enum(['entity', 'redaction', 'question', 'pattern']),
  xp_reward: z.number().int().min(0).max(1000).default(0),
  expires_at: z.string().datetime().optional(),
})

export type BountyCreateInput = z.infer<typeof bountyCreateSchema>

// --- Fact ---
export const factCreateSchema = z.object({
  fact_text: z.string().min(10).max(2000),
  entity_ids: z.array(z.string().uuid()).max(20).default([]),
  supporting_chunk_ids: z.array(z.string().uuid()).max(20).default([]),
  supporting_document_ids: z.array(z.string().uuid()).max(20).default([]),
})

export type FactCreateInput = z.infer<typeof factCreateSchema>

// --- Entity Connection Graph ---
export const entityConnectionsSchema = z.object({
  depth: z.number().int().min(1).max(4).default(2),
  limit: z.number().int().min(1).max(200).default(50),
})

export type EntityConnectionsInput = z.infer<typeof entityConnectionsSchema>

// --- Pagination ---
export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  per_page: z.number().int().min(1).max(100).default(20),
})

export type PaginationInput = z.infer<typeof paginationSchema>

// --- Temporal Proximity ---
export const temporalProximitySchema = z.object({
  entity_id: z.string().uuid(),
  window_days: z.number().int().min(1).max(365).default(7),
  max_results: z.number().int().min(1).max(500).default(100),
})

export type TemporalProximityInput = z.infer<typeof temporalProximitySchema>

// --- Path Finder ---
export const pathFinderSchema = z.object({
  source: z.string().min(1),
  target: z.string().min(1),
  max_depth: z.number().int().min(1).max(10).default(6),
})

export type PathFinderInput = z.infer<typeof pathFinderSchema>

// --- Flight Stats ---
export const flightStatsSchema = z.object({
  page: z.number().int().min(1).default(1),
  per_page: z.number().int().min(1).max(100).default(20),
  min_flights: z.number().int().min(1).default(1),
  sort: z.enum(['flight_count', 'entity_name', 'first_flight_date']).default('flight_count'),
})

export type FlightStatsInput = z.infer<typeof flightStatsSchema>

// --- Network Metrics ---
export const networkMetricsSchema = z.object({
  page: z.number().int().min(1).default(1),
  per_page: z.number().int().min(1).max(100).default(20),
  min_degree: z.number().int().min(0).default(1),
  cluster_id: z.number().int().optional(),
  sort: z.enum(['pagerank', 'betweenness', 'degree', 'entity_name']).default('pagerank'),
})

export type NetworkMetricsInput = z.infer<typeof networkMetricsSchema>

// --- Email Query ---
export const emailQuerySchema = z.object({
  page: z.number().int().min(1).default(1),
  per_page: z.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  entity_id: z.string().uuid().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  has_attachments: z.boolean().optional(),
  thread_id: z.string().optional(),
})

export type EmailQueryInput = z.infer<typeof emailQuerySchema>

// --- Financial Query ---
export const financialQuerySchema = z.object({
  page: z.number().int().min(1).default(1),
  per_page: z.number().int().min(1).max(100).default(20),
  entity_id: z.string().uuid().optional(),
  min_amount: z.number().min(0).optional(),
  max_amount: z.number().optional(),
  transaction_type: z.string().optional(),
  is_suspicious: z.boolean().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
})

export type FinancialQueryInput = z.infer<typeof financialQuerySchema>

// --- Contradiction ---
export const contradictionCreateSchema = z.object({
  claim_a: z.string().min(10).max(2000),
  claim_a_document_id: z.string().uuid().optional(),
  claim_a_chunk_id: z.string().uuid().optional(),
  claim_a_page_number: z.number().int().min(1).optional(),
  claim_b: z.string().min(10).max(2000),
  claim_b_document_id: z.string().uuid().optional(),
  claim_b_chunk_id: z.string().uuid().optional(),
  claim_b_page_number: z.number().int().min(1).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  description: z.string().max(5000).optional(),
  entity_ids: z.array(z.string().uuid()).max(20).default([]),
  tags: z.array(z.string().max(50)).max(10).default([]),
})

export type ContradictionCreateInput = z.infer<typeof contradictionCreateSchema>

export const contradictionQuerySchema = z.object({
  page: z.number().int().min(1).default(1),
  per_page: z.number().int().min(1).max(100).default(20),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  is_verified: z.boolean().optional(),
  entity_id: z.string().uuid().optional(),
})

export type ContradictionQueryInput = z.infer<typeof contradictionQuerySchema>

export const contradictionVoteSchema = z.object({
  vote_type: z.enum(['verify', 'dispute']),
})

export type ContradictionVoteInput = z.infer<typeof contradictionVoteSchema>

// --- Network Analysis ---
export const networkAnalysisSchema = z.object({
  page: z.number().int().min(1).default(1),
  per_page: z.number().int().min(1).max(100).default(20),
  sort: z.enum(['pagerank', 'betweenness', 'degree']).default('pagerank'),
  entity_type: z.enum([
    'person', 'organization', 'location', 'aircraft', 'vessel', 'property', 'account',
    'event', 'legal_case', 'government_body', 'trust', 'phone_number', 'vehicle', 'document_reference',
  ]).optional(),
})

export type NetworkAnalysisInput = z.infer<typeof networkAnalysisSchema>

/** Keys that should be coerced to numbers when parsing search params. */
const NUMERIC_PARAMS = new Set([
  'page', 'per_page', 'limit', 'offset', 'depth',
  'window_days', 'max_depth', 'max_results', 'min_amount', 'max_amount',
  'min_flights', 'min_degree', 'min_strength', 'cluster_id', 'claim_a_page_number', 'claim_b_page_number',
])

/**
 * Parse URL search params into an object for Zod validation.
 * Only coerces known numeric fields to avoid breaking UUIDs and other string values.
 */
export function parseSearchParams(url: URL): Record<string, unknown> {
  const params: Record<string, unknown> = {}
  for (const [key, value] of url.searchParams) {
    if (NUMERIC_PARAMS.has(key) && /^\d+$/.test(value)) {
      params[key] = parseInt(value, 10)
    } else if (value === 'true' || value === 'false') {
      params[key] = value === 'true'
    } else {
      params[key] = value
    }
  }
  return params
}

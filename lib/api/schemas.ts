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

/** Keys that should be coerced to numbers when parsing search params. */
const NUMERIC_PARAMS = new Set(['page', 'per_page', 'limit', 'offset', 'depth'])

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

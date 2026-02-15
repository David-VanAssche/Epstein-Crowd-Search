// lib/pipeline/prompts/types.ts
// Prompt routing types and tier mapping for classification-specific prompts.

import { DocumentType } from '@/lib/pipeline/services/classifier'

export const PROMPT_VERSION = '2.0.0'

export type PromptTier =
  | 'sworn'
  | 'official'
  | 'flight'
  | 'financial'
  | 'correspondence'
  | 'contacts'
  | 'default'

export interface PromptContext {
  primary: DocumentType
  primaryConfidence: number
  tags: DocumentType[]
  tier: PromptTier
  secondaryTiers: PromptTier[]
  documentId: string
  filename: string
}

const TIER_MAP: Record<DocumentType, PromptTier> = {
  // Sworn
  deposition: 'sworn',
  grand_jury_testimony: 'sworn',
  witness_statement: 'sworn',
  plea_agreement: 'sworn',
  // Official
  court_filing: 'official',
  indictment: 'official',
  subpoena: 'official',
  search_warrant: 'official',
  police_report: 'official',
  fbi_report: 'official',
  government_report: 'official',
  // Flight
  flight_log: 'flight',
  // Financial
  financial_record: 'financial',
  tax_filing: 'financial',
  trust_document: 'financial',
  corporate_filing: 'financial',
  receipt_invoice: 'financial',
  // Correspondence
  email: 'correspondence',
  letter: 'correspondence',
  memo: 'correspondence',
  fax: 'correspondence',
  correspondence: 'correspondence',
  // Contacts
  address_book: 'contacts',
  phone_record: 'contacts',
  calendar_schedule: 'contacts',
  // Default
  photograph: 'default',
  news_clipping: 'default',
  medical_record: 'default',
  property_record: 'default',
  other: 'default',
}

export function classificationToTier(type: DocumentType): PromptTier {
  return TIER_MAP[type] ?? 'default'
}

export function buildPromptContext(
  primary: string,
  tags: string[],
  metadata: { documentId: string; filename: string; primaryConfidence: number }
): PromptContext {
  const { documentId, filename, primaryConfidence } = metadata

  // Validate primary type — fall back to 'other' if unknown
  const validPrimary = (TIER_MAP[primary as DocumentType] !== undefined
    ? primary
    : 'other') as DocumentType

  // Guard against NaN/undefined confidence
  const safeConfidence = Number.isFinite(primaryConfidence) ? primaryConfidence : 0

  // Confidence gating: low confidence → default tier
  const tier = safeConfidence < 0.3
    ? 'default'
    : classificationToTier(validPrimary)

  // Sanitize tags: keep only valid DocumentType values (guard against null/undefined)
  const safeTags = Array.isArray(tags) ? tags : []
  const validTags = safeTags.filter(
    (t): t is DocumentType => TIER_MAP[t as DocumentType] !== undefined
  )

  // Secondary tiers: deduped, excluding primary tier, capped at 2
  const secondaryTiers = [
    ...new Set(validTags.map((t) => classificationToTier(t))),
  ]
    .filter((t) => t !== tier)
    .slice(0, 2)

  return {
    primary: validPrimary,
    primaryConfidence,
    tags: validTags,
    tier,
    secondaryTiers,
    documentId,
    filename,
  }
}

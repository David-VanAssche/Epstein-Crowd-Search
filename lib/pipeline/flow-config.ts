// lib/pipeline/flow-config.ts
// Maps each conditional stage to eligible classification types for the waterfall UI.
// Uses the same type groupings defined in stages.ts.

import type { DocumentType } from './services/classifier'
import { PipelineStage } from './stages'

// ── Type groups (mirroring stages.ts Sets as arrays for client use) ──

export const SWORN: DocumentType[] = [
  'deposition', 'grand_jury_testimony', 'witness_statement', 'plea_agreement',
]
export const OFFICIAL: DocumentType[] = [
  'court_filing', 'indictment', 'subpoena', 'search_warrant',
  'police_report', 'fbi_report', 'government_report',
]
export const RECORD: DocumentType[] = [
  'flight_log', 'financial_record', 'tax_filing', 'trust_document',
  'phone_record', 'medical_record', 'corporate_filing', 'property_record',
]
export const CORRESPONDENCE: DocumentType[] = [
  'email', 'letter', 'memo', 'fax', 'correspondence',
]
export const FINANCIAL: DocumentType[] = [
  'financial_record', 'tax_filing', 'trust_document', 'corporate_filing', 'receipt_invoice',
]
export const FLIGHT: DocumentType[] = ['flight_log']
export const TIMELINE_RICH: DocumentType[] = [
  'deposition', 'grand_jury_testimony', 'witness_statement', 'plea_agreement',
  'court_filing', 'indictment', 'fbi_report', 'government_report',
  'flight_log', 'calendar_schedule',
]

// ── Classification tier grouping for the breakdown UI ──

export interface ClassificationTier {
  label: string
  types: DocumentType[]
}

export const CLASSIFICATION_TIERS: ClassificationTier[] = [
  { label: 'Sworn Testimony', types: SWORN },
  { label: 'Official / Law Enforcement', types: OFFICIAL },
  { label: 'Records', types: RECORD },
  { label: 'Correspondence', types: CORRESPONDENCE },
  { label: 'Peripheral', types: ['address_book', 'photograph', 'news_clipping', 'calendar_schedule', 'receipt_invoice', 'other'] },
]

// ── Conditional stage eligibility ──

export interface ConditionalStageConfig {
  stage: PipelineStage
  label: string
  description: string
  types: DocumentType[]
  /** true = eligibility also depends on content flags (approximate count) */
  isHeuristic?: boolean
}

export const CONDITIONAL_STAGES: ConditionalStageConfig[] = [
  {
    stage: PipelineStage.VISUAL_EMBED,
    label: 'Visual Embedding',
    description: 'Photographs only',
    types: ['photograph'],
  },
  {
    stage: PipelineStage.RELATIONSHIP_MAP,
    label: 'Relationship Mapping',
    description: 'Sworn, official, record & correspondence documents',
    types: [...SWORN, ...OFFICIAL, ...RECORD, ...CORRESPONDENCE],
  },
  {
    stage: PipelineStage.REDACTION_DETECT,
    label: 'Redaction Detection',
    description: 'Documents with redaction markers',
    types: [], // Heuristic-only — depends on content flags, not classification
    isHeuristic: true,
  },
  {
    stage: PipelineStage.TIMELINE_EXTRACT,
    label: 'Timeline Extraction',
    description: 'Timeline-rich document types + date references',
    types: TIMELINE_RICH,
    isHeuristic: true, // Also triggered by hasDateReferences
  },
  {
    stage: PipelineStage.EMAIL_EXTRACT,
    label: 'Email Extraction',
    description: 'Correspondence types',
    types: CORRESPONDENCE,
    isHeuristic: true, // Also triggered by hasEmailHeaders
  },
  {
    stage: PipelineStage.FINANCIAL_EXTRACT,
    label: 'Financial Extraction',
    description: 'Financial document types',
    types: FINANCIAL,
    isHeuristic: true, // Also triggered by hasFinancialAmounts
  },
  {
    stage: PipelineStage.CRIMINAL_INDICATORS,
    label: 'Criminal Indicator Scoring',
    description: 'Sworn, official, financial & correspondence',
    types: [...SWORN, ...OFFICIAL, ...FINANCIAL, ...CORRESPONDENCE],
  },
  {
    stage: PipelineStage.CO_FLIGHT_LINKS,
    label: 'Co-Flight & Communication Links',
    description: 'Flight logs & correspondence',
    types: [...FLIGHT, ...CORRESPONDENCE],
    isHeuristic: true,
  },
  {
    stage: PipelineStage.CONGRESSIONAL_SCORE,
    label: 'Congressional Priority Scoring',
    description: 'Substantive document types',
    types: [...SWORN, ...OFFICIAL, ...RECORD, ...CORRESPONDENCE],
  },
  {
    stage: PipelineStage.SUBPOENA_EXTRACT,
    label: 'Subpoena Rider Extraction',
    description: 'Subpoena documents only',
    types: ['subpoena'],
  },
]

// ── Universal stages (run on all classified docs) ──

export const UNIVERSAL_STAGES: PipelineStage[] = [
  PipelineStage.CHUNK,
  PipelineStage.CONTEXTUAL_HEADERS,
  PipelineStage.EMBED,
  PipelineStage.ENTITY_EXTRACT,
  PipelineStage.SUMMARIZE,
]

// ── Global stages (run across all data, not per-document) ──

export const GLOBAL_STAGES: PipelineStage[] = [
  PipelineStage.NETWORK_METRICS,
  PipelineStage.RISK_SCORE,
]

// ── Helper: compute eligible count from classification breakdown ──

export function getEligibleCount(
  types: DocumentType[],
  breakdown: Record<string, number>,
): number {
  if (types.length === 0) return 0
  const unique = Array.from(new Set(types))
  return unique.reduce((sum, t) => sum + (breakdown[t] ?? 0), 0)
}

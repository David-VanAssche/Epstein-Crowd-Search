// lib/pipeline/stages.ts
// Defines all pipeline stages, their ordering, dependencies, and routing rules.

import type { DocumentType } from './services/classifier'

export enum PipelineStage {
  OCR = 'ocr',
  CLASSIFY = 'classify',
  CHUNK = 'chunk',
  CONTEXTUAL_HEADERS = 'contextual_headers',
  EMBED = 'embed',
  VISUAL_EMBED = 'visual_embed',
  ENTITY_EXTRACT = 'entity_extract',
  RELATIONSHIP_MAP = 'relationship_map',
  REDACTION_DETECT = 'redaction_detect',
  TIMELINE_EXTRACT = 'timeline_extract',
  SUMMARIZE = 'summarize',
  CRIMINAL_INDICATORS = 'criminal_indicators',
  EMAIL_EXTRACT = 'email_extract',
  FINANCIAL_EXTRACT = 'financial_extract',
  CO_FLIGHT_LINKS = 'co_flight_links',
  CONGRESSIONAL_SCORE = 'congressional_score',
  SUBPOENA_EXTRACT = 'subpoena_extract',
  NETWORK_METRICS = 'network_metrics',
  RISK_SCORE = 'risk_score',
}

// --- Classification-driven routing ---
// Document classification determines which conditional stages run.
// Stages marked alwaysRun=true run for all documents regardless of classification.

/** Classification info used for routing decisions */
export interface DocumentClassification {
  primary: DocumentType
  tags: DocumentType[]
  /** Content heuristic flags from chunker (set on at least one chunk) */
  hasEmailHeaders: boolean
  hasFinancialAmounts: boolean
  hasRedactionMarkers: boolean
  hasDateReferences: boolean
}

// Type groups for routing logic
const SWORN_TYPES = new Set<DocumentType>([
  'deposition', 'grand_jury_testimony', 'witness_statement', 'plea_agreement',
])
const OFFICIAL_TYPES = new Set<DocumentType>([
  'court_filing', 'indictment', 'subpoena', 'search_warrant',
  'police_report', 'fbi_report', 'government_report',
])
const RECORD_TYPES = new Set<DocumentType>([
  'flight_log', 'financial_record', 'tax_filing', 'trust_document',
  'phone_record', 'medical_record', 'corporate_filing', 'property_record',
])
const CORRESPONDENCE_TYPES = new Set<DocumentType>([
  'email', 'letter', 'memo', 'fax', 'correspondence',
])
const FINANCIAL_TYPES = new Set<DocumentType>([
  'financial_record', 'tax_filing', 'trust_document', 'corporate_filing', 'receipt_invoice',
])
const FLIGHT_TYPES = new Set<DocumentType>([
  'flight_log',
])
const STRUCTURED_TYPES = new Set<DocumentType>([
  'flight_log', 'financial_record', 'phone_record', 'address_book',
])
const TIMELINE_RICH_TYPES = new Set<DocumentType>([
  'deposition', 'grand_jury_testimony', 'witness_statement', 'plea_agreement',
  'court_filing', 'indictment', 'fbi_report', 'government_report',
  'flight_log', 'calendar_schedule',
])

function classificationHasAny(c: DocumentClassification, typeSet: Set<DocumentType>): boolean {
  return typeSet.has(c.primary) || c.tags.some((t) => typeSet.has(t))
}

export interface StageDefinition {
  stage: PipelineStage
  label: string
  description: string
  /** Stages that must complete before this one runs */
  dependsOn: PipelineStage[]
  /** Estimated cost per page (USD) for budget tracking */
  estimatedCostPerPage: number
  /** Whether this stage can be safely re-run without side effects */
  idempotent: boolean
  /** Max retries before marking as failed */
  maxRetries: number
  /** If true, runs for every document. If false, shouldRun() determines eligibility. */
  alwaysRun: boolean
  /**
   * Returns true if this stage should run for the given document classification.
   * Only called when alwaysRun is false.
   * Uses both classification labels AND content heuristic flags for fallback routing.
   */
  shouldRun?: (classification: DocumentClassification) => boolean
}

export const STAGE_DEFINITIONS: StageDefinition[] = [
  {
    stage: PipelineStage.OCR,
    label: 'OCR',
    description: 'Extract text from PDF/image using Document AI or Vision OCR',
    dependsOn: [],
    estimatedCostPerPage: 0.0015,
    idempotent: true,
    maxRetries: 3,
    alwaysRun: true,
  },
  {
    stage: PipelineStage.CLASSIFY,
    label: 'Classification',
    description: 'Classify document into ~30 types with multi-label support (primary + tags)',
    dependsOn: [PipelineStage.OCR],
    estimatedCostPerPage: 0.0002,
    idempotent: true,
    maxRetries: 3,
    alwaysRun: true,
  },
  {
    stage: PipelineStage.CHUNK,
    label: 'Chunking',
    description: 'Split OCR text into 800-1500 char chunks with content heuristic flags',
    dependsOn: [PipelineStage.OCR],
    estimatedCostPerPage: 0.0,
    idempotent: true,
    maxRetries: 1,
    alwaysRun: true,
  },
  {
    stage: PipelineStage.CONTEXTUAL_HEADERS,
    label: 'Contextual Headers',
    description: 'Generate 50-100 token context header per chunk using LLM',
    dependsOn: [PipelineStage.CHUNK],
    estimatedCostPerPage: 0.0005,
    idempotent: true,
    maxRetries: 3,
    alwaysRun: true,
  },
  {
    stage: PipelineStage.EMBED,
    label: 'Text Embedding',
    description: 'Generate 1024d Nova embeddings for all chunks (text via AWS Bedrock)',
    dependsOn: [PipelineStage.CONTEXTUAL_HEADERS],
    estimatedCostPerPage: 0.0001,
    idempotent: true,
    maxRetries: 3,
    alwaysRun: true,
  },
  {
    stage: PipelineStage.VISUAL_EMBED,
    label: 'Visual Embedding',
    description: 'Generate 1024d Nova visual embeddings for images (same unified space as text)',
    dependsOn: [PipelineStage.OCR],
    estimatedCostPerPage: 0.0003,
    idempotent: true,
    maxRetries: 3,
    alwaysRun: false,
    shouldRun: (c) => c.primary === 'photograph' || c.tags.includes('photograph'),
  },
  {
    stage: PipelineStage.ENTITY_EXTRACT,
    label: 'Entity Extraction',
    description: 'Extract named entities (people, orgs, locations, etc.) from chunks',
    dependsOn: [PipelineStage.CHUNK],
    estimatedCostPerPage: 0.001,
    idempotent: false,
    maxRetries: 3,
    alwaysRun: true,
  },
  {
    stage: PipelineStage.RELATIONSHIP_MAP,
    label: 'Relationship Mapping',
    description: 'Identify entity-to-entity relationships from chunk text',
    dependsOn: [PipelineStage.ENTITY_EXTRACT],
    estimatedCostPerPage: 0.0008,
    idempotent: false,
    maxRetries: 3,
    alwaysRun: false,
    // Run for substantive document types — skip for address book, photos, news clippings
    shouldRun: (c) =>
      classificationHasAny(c, SWORN_TYPES) ||
      classificationHasAny(c, OFFICIAL_TYPES) ||
      classificationHasAny(c, RECORD_TYPES) ||
      classificationHasAny(c, CORRESPONDENCE_TYPES),
  },
  {
    stage: PipelineStage.REDACTION_DETECT,
    label: 'Redaction Detection',
    description: 'Detect and catalog redacted regions with surrounding context',
    dependsOn: [PipelineStage.CHUNK],
    estimatedCostPerPage: 0.0005,
    idempotent: true,
    maxRetries: 3,
    alwaysRun: false,
    // Only run if content heuristic found redaction markers in any chunk
    shouldRun: (c) => c.hasRedactionMarkers,
  },
  {
    stage: PipelineStage.TIMELINE_EXTRACT,
    label: 'Timeline Extraction',
    description: 'Extract dated events and create timeline entries',
    dependsOn: [PipelineStage.ENTITY_EXTRACT],
    estimatedCostPerPage: 0.0005,
    idempotent: false,
    maxRetries: 3,
    alwaysRun: false,
    // Run for timeline-rich doc types OR if content heuristic found dates
    shouldRun: (c) =>
      classificationHasAny(c, TIMELINE_RICH_TYPES) || c.hasDateReferences,
  },
  {
    stage: PipelineStage.SUMMARIZE,
    label: 'Document Summary',
    description: 'Generate executive summary with key people, time period, significance',
    dependsOn: [PipelineStage.ENTITY_EXTRACT],
    estimatedCostPerPage: 0.0003,
    idempotent: true,
    maxRetries: 3,
    alwaysRun: true,
  },
  {
    stage: PipelineStage.CRIMINAL_INDICATORS,
    label: 'Criminal Indicator Scoring',
    description: 'Flag evidence of trafficking, obstruction, conspiracy, financial crimes',
    dependsOn: [PipelineStage.ENTITY_EXTRACT, PipelineStage.RELATIONSHIP_MAP],
    estimatedCostPerPage: 0.0008,
    idempotent: true,
    maxRetries: 3,
    alwaysRun: false,
    // Run for sworn testimony, official docs, and financial records — skip peripheral
    shouldRun: (c) =>
      classificationHasAny(c, SWORN_TYPES) ||
      classificationHasAny(c, OFFICIAL_TYPES) ||
      classificationHasAny(c, FINANCIAL_TYPES) ||
      classificationHasAny(c, CORRESPONDENCE_TYPES),
  },
  {
    stage: PipelineStage.EMAIL_EXTRACT,
    label: 'Email Extraction',
    description: 'Extract structured email data (from/to/cc, body, threads)',
    dependsOn: [PipelineStage.ENTITY_EXTRACT],
    estimatedCostPerPage: 0.0006,
    idempotent: true,
    maxRetries: 3,
    alwaysRun: false,
    // Run if classified as correspondence OR content heuristic found email headers
    shouldRun: (c) =>
      classificationHasAny(c, CORRESPONDENCE_TYPES) || c.hasEmailHeaders,
  },
  {
    stage: PipelineStage.FINANCIAL_EXTRACT,
    label: 'Financial Extraction',
    description: 'Extract financial transactions, wire transfers, and payments with suspicious pattern flagging',
    dependsOn: [PipelineStage.ENTITY_EXTRACT],
    estimatedCostPerPage: 0.0006,
    idempotent: true,
    maxRetries: 3,
    alwaysRun: false,
    // Run if classified as financial OR content heuristic found dollar amounts
    shouldRun: (c) =>
      classificationHasAny(c, FINANCIAL_TYPES) || c.hasFinancialAmounts,
  },
  {
    stage: PipelineStage.CO_FLIGHT_LINKS,
    label: 'Co-Flight Link Generation',
    description: 'Generate traveled_with relationships from shared flights and communicated_with from email co-occurrence',
    dependsOn: [PipelineStage.EMAIL_EXTRACT, PipelineStage.ENTITY_EXTRACT],
    estimatedCostPerPage: 0.0,
    idempotent: true,
    maxRetries: 2,
    alwaysRun: false,
    // Only run if flight logs or correspondence were found
    shouldRun: (c) =>
      classificationHasAny(c, FLIGHT_TYPES) ||
      classificationHasAny(c, CORRESPONDENCE_TYPES) ||
      c.hasEmailHeaders,
  },
  {
    stage: PipelineStage.CONGRESSIONAL_SCORE,
    label: 'Congressional Priority Scoring',
    description: 'Score documents by investigation priority using keyword severity, redaction density, and name proximity',
    dependsOn: [PipelineStage.CRIMINAL_INDICATORS, PipelineStage.REDACTION_DETECT],
    estimatedCostPerPage: 0.0, // Rule-based, no LLM
    idempotent: true,
    maxRetries: 2,
    alwaysRun: false,
    // Run for substantive documents — skip peripheral content
    shouldRun: (c) =>
      classificationHasAny(c, SWORN_TYPES) ||
      classificationHasAny(c, OFFICIAL_TYPES) ||
      classificationHasAny(c, RECORD_TYPES) ||
      classificationHasAny(c, CORRESPONDENCE_TYPES),
  },
  {
    stage: PipelineStage.SUBPOENA_EXTRACT,
    label: 'Subpoena Rider Extraction',
    description: 'Extract structured data from Grand Jury subpoena riders using regex',
    dependsOn: [PipelineStage.CLASSIFY, PipelineStage.CHUNK],
    estimatedCostPerPage: 0.0, // Rule-based, no LLM
    idempotent: true,
    maxRetries: 2,
    alwaysRun: false,
    shouldRun: (c) => c.primary === 'subpoena' || c.tags.includes('subpoena'),
  },
  {
    stage: PipelineStage.NETWORK_METRICS,
    label: 'Network Metrics Computation',
    description: 'Compute PageRank, betweenness centrality, and community detection across entity network',
    dependsOn: [PipelineStage.CO_FLIGHT_LINKS],
    estimatedCostPerPage: 0.0,
    idempotent: true,
    maxRetries: 2,
    alwaysRun: true, // Network metrics are global — always recompute
  },
  {
    stage: PipelineStage.RISK_SCORE,
    label: 'Entity Risk Scoring',
    description: 'Compute per-entity risk scores from evidence weights, relationships, and criminal indicators',
    dependsOn: [PipelineStage.CRIMINAL_INDICATORS, PipelineStage.NETWORK_METRICS],
    estimatedCostPerPage: 0.0,
    idempotent: true,
    maxRetries: 2,
    alwaysRun: true, // Risk scoring is global — always recompute
  },
]

/**
 * Returns stages in topological order (respecting dependencies).
 * The hardcoded STAGE_DEFINITIONS array is already in correct order,
 * but this function validates that invariant at runtime.
 */
export function getOrderedStages(): PipelineStage[] {
  const resolved = new Set<PipelineStage>()
  const ordered: PipelineStage[] = []

  const defs = new Map(STAGE_DEFINITIONS.map((d) => [d.stage, d]))

  function resolve(stage: PipelineStage): void {
    if (resolved.has(stage)) return
    const def = defs.get(stage)
    if (!def) throw new Error(`Unknown stage: ${stage}`)
    for (const dep of def.dependsOn) {
      resolve(dep)
    }
    resolved.add(stage)
    ordered.push(stage)
  }

  for (const def of STAGE_DEFINITIONS) {
    resolve(def.stage)
  }

  return ordered
}

/** Map of processing_status values used in documents table */
export const PROCESSING_STATUS = {
  PENDING: 'pending',
  COMMUNITY: 'community', // From community ingestion — eligible for processing but skip what's already done
  OCR: 'ocr',
  CLASSIFYING: 'classifying',
  CHUNKING: 'chunking',
  EMBEDDING: 'embedding',
  ENTITY_EXTRACTION: 'entity_extraction',
  RELATIONSHIP_MAPPING: 'relationship_mapping',
  REDACTION_DETECTION: 'redaction_detection',
  SUMMARIZING: 'summarizing',
  COMPLETE: 'complete',
  FAILED: 'failed',
} as const

export type ProcessingStatus = (typeof PROCESSING_STATUS)[keyof typeof PROCESSING_STATUS]

/** Map a pipeline stage to the documents.processing_status value */
export function stageToStatus(stage: PipelineStage): ProcessingStatus {
  const map: Record<PipelineStage, ProcessingStatus> = {
    [PipelineStage.OCR]: PROCESSING_STATUS.OCR,
    [PipelineStage.CLASSIFY]: PROCESSING_STATUS.CLASSIFYING,
    [PipelineStage.CHUNK]: PROCESSING_STATUS.CHUNKING,
    [PipelineStage.CONTEXTUAL_HEADERS]: PROCESSING_STATUS.CHUNKING,
    [PipelineStage.EMBED]: PROCESSING_STATUS.EMBEDDING,
    [PipelineStage.VISUAL_EMBED]: PROCESSING_STATUS.EMBEDDING,
    [PipelineStage.ENTITY_EXTRACT]: PROCESSING_STATUS.ENTITY_EXTRACTION,
    [PipelineStage.RELATIONSHIP_MAP]: PROCESSING_STATUS.RELATIONSHIP_MAPPING,
    [PipelineStage.REDACTION_DETECT]: PROCESSING_STATUS.REDACTION_DETECTION,
    [PipelineStage.TIMELINE_EXTRACT]: PROCESSING_STATUS.ENTITY_EXTRACTION,
    [PipelineStage.SUMMARIZE]: PROCESSING_STATUS.SUMMARIZING,
    [PipelineStage.CRIMINAL_INDICATORS]: PROCESSING_STATUS.SUMMARIZING,
    [PipelineStage.EMAIL_EXTRACT]: PROCESSING_STATUS.ENTITY_EXTRACTION,
    [PipelineStage.FINANCIAL_EXTRACT]: PROCESSING_STATUS.ENTITY_EXTRACTION,
    [PipelineStage.CO_FLIGHT_LINKS]: PROCESSING_STATUS.COMPLETE,
    [PipelineStage.CONGRESSIONAL_SCORE]: PROCESSING_STATUS.SUMMARIZING,
    [PipelineStage.SUBPOENA_EXTRACT]: PROCESSING_STATUS.ENTITY_EXTRACTION,
    [PipelineStage.NETWORK_METRICS]: PROCESSING_STATUS.COMPLETE,
    [PipelineStage.RISK_SCORE]: PROCESSING_STATUS.COMPLETE,
  }
  return map[stage]
}

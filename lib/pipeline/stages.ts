// lib/pipeline/stages.ts
// Defines all pipeline stages, their ordering, and dependencies.

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
  NETWORK_METRICS = 'network_metrics',
  RISK_SCORE = 'risk_score',
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
  },
  {
    stage: PipelineStage.CLASSIFY,
    label: 'Classification',
    description: 'Classify document into one of 16 types (deposition, flight log, etc.)',
    dependsOn: [PipelineStage.OCR],
    estimatedCostPerPage: 0.0002,
    idempotent: true,
    maxRetries: 3,
  },
  {
    stage: PipelineStage.CHUNK,
    label: 'Chunking',
    description: 'Split OCR text into 800-1500 char chunks respecting section boundaries',
    dependsOn: [PipelineStage.OCR],
    estimatedCostPerPage: 0.0,
    idempotent: true,
    maxRetries: 1,
  },
  {
    stage: PipelineStage.CONTEXTUAL_HEADERS,
    label: 'Contextual Headers',
    description: 'Generate 50-100 token context header per chunk using LLM',
    dependsOn: [PipelineStage.CHUNK],
    estimatedCostPerPage: 0.0005,
    idempotent: true,
    maxRetries: 3,
  },
  {
    stage: PipelineStage.EMBED,
    label: 'Text Embedding',
    description: 'Generate 1024d Nova embeddings for all chunks (text via AWS Bedrock)',
    dependsOn: [PipelineStage.CONTEXTUAL_HEADERS],
    estimatedCostPerPage: 0.0001,
    idempotent: true,
    maxRetries: 3,
  },
  {
    stage: PipelineStage.VISUAL_EMBED,
    label: 'Visual Embedding',
    description: 'Generate 1024d Nova visual embeddings for images (same unified space as text)',
    dependsOn: [PipelineStage.OCR],
    estimatedCostPerPage: 0.0003,
    idempotent: true,
    maxRetries: 3,
  },
  {
    stage: PipelineStage.ENTITY_EXTRACT,
    label: 'Entity Extraction',
    description: 'Extract named entities (people, orgs, locations, etc.) from chunks',
    dependsOn: [PipelineStage.CHUNK],
    estimatedCostPerPage: 0.001,
    idempotent: false, // creates entity_mentions — re-running may duplicate
    maxRetries: 3,
  },
  {
    stage: PipelineStage.RELATIONSHIP_MAP,
    label: 'Relationship Mapping',
    description: 'Identify entity-to-entity relationships from chunk text',
    dependsOn: [PipelineStage.ENTITY_EXTRACT],
    estimatedCostPerPage: 0.0008,
    idempotent: false,
    maxRetries: 3,
  },
  {
    stage: PipelineStage.REDACTION_DETECT,
    label: 'Redaction Detection',
    description: 'Detect and catalog redacted regions with surrounding context',
    dependsOn: [PipelineStage.CHUNK],
    estimatedCostPerPage: 0.0005,
    idempotent: true,
    maxRetries: 3,
  },
  {
    stage: PipelineStage.TIMELINE_EXTRACT,
    label: 'Timeline Extraction',
    description: 'Extract dated events and create timeline entries',
    dependsOn: [PipelineStage.ENTITY_EXTRACT],
    estimatedCostPerPage: 0.0005,
    idempotent: false,
    maxRetries: 3,
  },
  {
    stage: PipelineStage.SUMMARIZE,
    label: 'Document Summary',
    description: 'Generate executive summary with key people, time period, significance',
    dependsOn: [PipelineStage.ENTITY_EXTRACT],
    estimatedCostPerPage: 0.0003,
    idempotent: true,
    maxRetries: 3,
  },
  {
    stage: PipelineStage.CRIMINAL_INDICATORS,
    label: 'Criminal Indicator Scoring',
    description: 'Flag evidence of trafficking, obstruction, conspiracy, financial crimes',
    dependsOn: [PipelineStage.ENTITY_EXTRACT, PipelineStage.RELATIONSHIP_MAP],
    estimatedCostPerPage: 0.0008,
    idempotent: true,
    maxRetries: 3,
  },
  {
    stage: PipelineStage.EMAIL_EXTRACT,
    label: 'Email Extraction',
    description: 'Extract structured email data (from/to/cc, body, threads) from documents classified as correspondence',
    dependsOn: [PipelineStage.ENTITY_EXTRACT],
    estimatedCostPerPage: 0.0006,
    idempotent: true,
    maxRetries: 3,
  },
  {
    stage: PipelineStage.FINANCIAL_EXTRACT,
    label: 'Financial Extraction',
    description: 'Extract financial transactions, wire transfers, and payments with suspicious pattern flagging',
    dependsOn: [PipelineStage.ENTITY_EXTRACT],
    estimatedCostPerPage: 0.0006,
    idempotent: true,
    maxRetries: 3,
  },
  {
    stage: PipelineStage.CO_FLIGHT_LINKS,
    label: 'Co-Flight Link Generation',
    description: 'Generate traveled_with relationships from shared flights and communicated_with from email co-occurrence',
    dependsOn: [PipelineStage.EMAIL_EXTRACT, PipelineStage.ENTITY_EXTRACT],
    estimatedCostPerPage: 0.0,
    idempotent: true,
    maxRetries: 2,
  },
  {
    stage: PipelineStage.NETWORK_METRICS,
    label: 'Network Metrics Computation',
    description: 'Compute PageRank, betweenness centrality, and community detection across entity network',
    dependsOn: [PipelineStage.CO_FLIGHT_LINKS],
    estimatedCostPerPage: 0.0,
    idempotent: true,
    maxRetries: 2,
  },
  {
    stage: PipelineStage.RISK_SCORE,
    label: 'Entity Risk Scoring',
    description: 'Compute per-entity risk scores from evidence weights, relationships, and criminal indicators',
    dependsOn: [PipelineStage.CRIMINAL_INDICATORS, PipelineStage.NETWORK_METRICS],
    estimatedCostPerPage: 0.0,
    idempotent: true,
    maxRetries: 2,
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
    [PipelineStage.NETWORK_METRICS]: PROCESSING_STATUS.COMPLETE,
    [PipelineStage.RISK_SCORE]: PROCESSING_STATUS.COMPLETE,
  }
  return map[stage]
}

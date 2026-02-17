// lib/pipeline/stage-info.ts
// Human-readable metadata for each pipeline stage.
// Used by the pipeline dashboard to explain costs, outputs, and value to users.

import { PipelineStage } from './stages'

export interface MediaCosts {
  /** Cost per PDF/document page */
  perPage: number
  /** Cost per standalone image */
  perImage: number
  /** Cost per minute of video */
  perVideoMinute: number
  /** Cost per minute of audio */
  perAudioMinute: number
}

export interface StageInfo {
  stage: PipelineStage
  label: string
  /** What this stage does — one sentence */
  whatItDoes: string
  /** What completing this stage unlocks — what users gain */
  whatItUnlocks: string
  /** Per-unit costs by media type */
  costs: MediaCosts
  /** Icon name from lucide-react */
  icon: string
  /** Visual layer grouping (0 = foundation, higher = later) */
  layer: number
}

/**
 * Comprehensive cost and benefit metadata for every pipeline stage.
 *
 * Cost estimates based on:
 * - Google Document AI OCR: ~$1.50/1000 pages
 * - AWS Nova Embed (text + multimodal): ~$0.10-0.30/1M tokens
 * - Gemini Flash for classification/extraction: ~$0.075/1M input tokens
 * - Gemini Pro for summarization/complex extraction: ~$0.50/1M input tokens
 * - Whisper (via Fireworks): ~$0.006/minute
 * - Local compute stages: $0.00
 */
export const PIPELINE_STAGE_INFO: StageInfo[] = [
  // ── Layer 0: Foundation ──
  {
    stage: PipelineStage.OCR,
    label: 'OCR & Text Extraction',
    whatItDoes:
      'Converts scanned PDFs, photos, and handwritten documents into machine-readable text using Google Document AI.',
    whatItUnlocks:
      'Makes every document searchable. Without OCR, scanned pages are just images — invisible to search, AI analysis, and entity extraction.',
    costs: { perPage: 0.0015, perImage: 0.002, perVideoMinute: 0.006, perAudioMinute: 0.006 },
    icon: 'ScanText',
    layer: 0,
  },

  // ── Layer 1: Understanding ──
  {
    stage: PipelineStage.CLASSIFY,
    label: 'Document Classification',
    whatItDoes:
      'Categorizes each document into one of 16 types: deposition, flight log, financial record, correspondence, court filing, police report, and more.',
    whatItUnlocks:
      'Enables filtered browsing ("show me all flight logs") and routes documents to specialized extractors (email parser, financial analyzer, etc.).',
    costs: { perPage: 0.0002, perImage: 0.0002, perVideoMinute: 0.0, perAudioMinute: 0.0 },
    icon: 'FolderKanban',
    layer: 1,
  },
  {
    stage: PipelineStage.CHUNK,
    label: 'Smart Chunking',
    whatItDoes:
      'Splits extracted text into 800-1500 character chunks that respect paragraph and section boundaries — no mid-sentence breaks.',
    whatItUnlocks:
      'Creates the atomic units for embedding and search. Good chunks mean better search results and more accurate AI analysis.',
    costs: { perPage: 0.0, perImage: 0.0, perVideoMinute: 0.0, perAudioMinute: 0.0 },
    icon: 'LayoutList',
    layer: 1,
  },
  {
    stage: PipelineStage.VISUAL_EMBED,
    label: 'Visual Embedding',
    whatItDoes:
      'Generates a 1024-dimensional vector for each image using AWS Nova multimodal embeddings, placing images in the same search space as text.',
    whatItUnlocks:
      'Enables "search by meaning" across both text and images. Find photos related to a text query, or find documents similar to a photo.',
    costs: { perPage: 0.0003, perImage: 0.0003, perVideoMinute: 0.002, perAudioMinute: 0.0 },
    icon: 'Eye',
    layer: 1,
  },

  // ── Layer 2: Enrichment ──
  {
    stage: PipelineStage.CONTEXTUAL_HEADERS,
    label: 'Contextual Headers',
    whatItDoes:
      'An LLM reads the full document and generates a 50-100 token summary header for each chunk, situating it within the broader document context.',
    whatItUnlocks:
      'Dramatically improves search quality. A chunk about "the island" gets a header like "Deposition of [name] regarding visits to Little St. James, 2003-2005."',
    costs: { perPage: 0.0005, perImage: 0.0, perVideoMinute: 0.0, perAudioMinute: 0.0 },
    icon: 'TextQuote',
    layer: 2,
  },
  {
    stage: PipelineStage.ENTITY_EXTRACT,
    label: 'Entity Extraction',
    whatItDoes:
      'AI identifies every person, organization, location, aircraft, property, financial account, and other entities mentioned in each chunk.',
    whatItUnlocks:
      'Powers the entity database, relationship graph, and "who appears in this document" views. The foundation for all network analysis.',
    costs: { perPage: 0.001, perImage: 0.001, perVideoMinute: 0.005, perAudioMinute: 0.005 },
    icon: 'Users',
    layer: 2,
  },
  {
    stage: PipelineStage.REDACTION_DETECT,
    label: 'Redaction Detection',
    whatItDoes:
      'Identifies blacked-out regions in documents, catalogs their location, and captures surrounding context to help researchers infer what was hidden.',
    whatItUnlocks:
      'Creates the redaction database. Community members can propose what was redacted and vote on accuracy, crowdsourcing government transparency.',
    costs: { perPage: 0.0005, perImage: 0.0005, perVideoMinute: 0.0, perAudioMinute: 0.0 },
    icon: 'EyeOff',
    layer: 2,
  },

  // ── Layer 3: Deep Analysis ──
  {
    stage: PipelineStage.EMBED,
    label: 'Text Embedding',
    whatItDoes:
      'Generates a 1024-dimensional vector for each text chunk (with its contextual header) using AWS Nova embeddings.',
    whatItUnlocks:
      'Powers semantic search — find documents by meaning, not just keywords. "money laundering through shell companies" finds relevant passages even without those exact words.',
    costs: { perPage: 0.0001, perImage: 0.0, perVideoMinute: 0.0001, perAudioMinute: 0.0001 },
    icon: 'Binary',
    layer: 3,
  },
  {
    stage: PipelineStage.RELATIONSHIP_MAP,
    label: 'Relationship Mapping',
    whatItDoes:
      'AI analyzes text to identify how entities relate: employer/employee, co-travelers, financial transactions, legal representation, family ties.',
    whatItUnlocks:
      'Builds the knowledge graph. See who is connected to whom and how — the backbone of network visualization and investigation tools.',
    costs: { perPage: 0.0008, perImage: 0.0, perVideoMinute: 0.004, perAudioMinute: 0.004 },
    icon: 'Share2',
    layer: 3,
  },
  {
    stage: PipelineStage.TIMELINE_EXTRACT,
    label: 'Timeline Extraction',
    whatItDoes:
      'Extracts dated events from documents: meetings, flights, transactions, legal proceedings, with participants and locations.',
    whatItUnlocks:
      'Powers the interactive timeline view. Reconstruct sequences of events across thousands of documents to identify patterns.',
    costs: { perPage: 0.0005, perImage: 0.0, perVideoMinute: 0.003, perAudioMinute: 0.003 },
    icon: 'Clock',
    layer: 3,
  },
  {
    stage: PipelineStage.SUMMARIZE,
    label: 'Document Summary',
    whatItDoes:
      'Generates an executive summary of each document: key people involved, time period, significance, and connection to the broader case.',
    whatItUnlocks:
      'Lets researchers quickly triage documents without reading every page. Summaries appear in search results and document views.',
    costs: { perPage: 0.0003, perImage: 0.0, perVideoMinute: 0.002, perAudioMinute: 0.002 },
    icon: 'FileText',
    layer: 3,
  },
  {
    stage: PipelineStage.EMAIL_EXTRACT,
    label: 'Email Extraction',
    whatItDoes:
      'For correspondence documents: parses sender, recipients, CC, date, subject, body, and thread structure into structured data.',
    whatItUnlocks:
      'Powers the email browser. See communication chains, who emailed whom, and reconstruct conversations across scattered documents.',
    costs: { perPage: 0.0006, perImage: 0.0, perVideoMinute: 0.0, perAudioMinute: 0.0 },
    icon: 'Mail',
    layer: 3,
  },
  {
    stage: PipelineStage.FINANCIAL_EXTRACT,
    label: 'Financial Extraction',
    whatItDoes:
      'Extracts wire transfers, payments, account numbers, and transaction amounts. Flags suspicious patterns like structuring and round-tripping.',
    whatItUnlocks:
      'Powers the financial investigation view. Follow the money across bank records, invoices, and tax documents.',
    costs: { perPage: 0.0006, perImage: 0.0, perVideoMinute: 0.0, perAudioMinute: 0.0 },
    icon: 'DollarSign',
    layer: 3,
  },

  // ── Layer 4: Scoring & Linking ──
  {
    stage: PipelineStage.CRIMINAL_INDICATORS,
    label: 'Criminal Indicator Scoring',
    whatItDoes:
      'AI evaluates each document for evidence of trafficking, obstruction of justice, conspiracy, witness tampering, and financial crimes.',
    whatItUnlocks:
      'Prioritizes the most legally significant documents. Researchers and prosecutors can focus on high-evidence material first.',
    costs: { perPage: 0.0008, perImage: 0.0, perVideoMinute: 0.004, perAudioMinute: 0.004 },
    icon: 'AlertTriangle',
    layer: 4,
  },
  {
    stage: PipelineStage.CO_FLIGHT_LINKS,
    label: 'Co-Flight & Communication Links',
    whatItDoes:
      'Cross-references flight logs with passenger lists to find who traveled together, and email headers to find communication clusters.',
    whatItUnlocks:
      'Reveals hidden connections: who was on the same flights to the same destinations, who communicated frequently in the same time periods.',
    costs: { perPage: 0.0, perImage: 0.0, perVideoMinute: 0.0, perAudioMinute: 0.0 },
    icon: 'Plane',
    layer: 4,
  },

  // ── Layer 5: Network Intelligence ──
  {
    stage: PipelineStage.NETWORK_METRICS,
    label: 'Network Analysis',
    whatItDoes:
      'Computes PageRank, betweenness centrality, and community detection across the entire entity relationship graph.',
    whatItUnlocks:
      'Identifies the most connected and influential individuals in the network. Reveals clusters and bridge figures who link separate groups.',
    costs: { perPage: 0.0, perImage: 0.0, perVideoMinute: 0.0, perAudioMinute: 0.0 },
    icon: 'Network',
    layer: 5,
  },

  // ── Layer 6: Final Scoring ──
  {
    stage: PipelineStage.RISK_SCORE,
    label: 'Entity Risk Scoring',
    whatItDoes:
      'Computes a composite risk score for each entity based on criminal indicators, network centrality, document frequency, and relationship weights.',
    whatItUnlocks:
      'Powers the "Black Book" ranked view. Surfaces entities with the strongest evidentiary connections for researcher prioritization.',
    costs: { perPage: 0.0, perImage: 0.0, perVideoMinute: 0.0, perAudioMinute: 0.0 },
    icon: 'ShieldAlert',
    layer: 6,
  },
]


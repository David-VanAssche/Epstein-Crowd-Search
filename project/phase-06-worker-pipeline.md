# Phase 6: Worker Pipeline

> **Sessions:** 3-4 | **Dependencies:** Phase 2 (database schema, types), Phase 4 (AI abstractions in `lib/ai/`) | **Parallel with:** Nothing (depends on Phase 4)

## Summary

Build the standalone Node.js worker process that powers the entire document-processing pipeline and the AI chatbot. The worker is a separate project (`worker/`) with its own `package.json`, TypeScript config, and Express server. It connects to the same Supabase project using a service-role key and shares AI provider interfaces from the main project.

The pipeline has 12 stages: OCR, classification, chunking, contextual headers, text embedding, visual embedding, entity extraction, relationship mapping, redaction detection, timeline extraction, document summarization, and criminal indicator scoring. Additional services handle audio/video transcription, structured data extraction, entity merge detection, pattern detection, and the redaction cascade engine.

The worker also hosts the chat API — an agentic tool-calling loop with RAG retrieval, intent classification, 8 specialized tools, and streaming SSE output. Operational scripts handle dataset downloads, sample seeding, directory ingestion, and cost estimation.

## IMPORTANT: Pre-requisites

Before starting Phase 6, verify:
1. Phase 2 is complete (all 18 migrations applied, types defined)
2. Phase 4 is complete (AI provider interfaces in `lib/ai/` — `OCRProvider`, `EmbeddingProvider`, `ChatProvider`, `ClassifierProvider`, `TranscriptionProvider`, `VisualEmbeddingProvider`, `RerankProvider`)
3. You have API keys for at least one provider per interface (e.g., Google AI for OCR/embeddings/chat, Cohere for reranking)
4. Redis is available locally or you plan to use the polling-based fallback queue
5. Supabase service role key is available (not the anon key — the worker needs full access)

---

## Step-by-Step Execution

### Step 1: Initialize the worker project

Create the standalone Node.js project inside `worker/`.

```bash
mkdir -p worker/src/{pipeline,services,chatbot/tools,api}
cd worker
pnpm init
```

File: `worker/package.json`

```json
{
  "name": "epstein-worker",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "build": "tsc",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.39.0",
    "bullmq": "^5.1.0",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "ioredis": "^5.3.2",
    "zod": "^3.22.4",
    "crypto-js": "^4.2.0",
    "lru-cache": "^10.1.0",
    "pdf-parse": "^1.1.1",
    "sharp": "^0.33.2",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/crypto-js": "^4.2.1",
    "@types/node": "^20.10.0",
    "@types/uuid": "^9.0.7",
    "tsx": "^4.7.0",
    "typescript": "^5.3.2"
  }
}
```

File: `worker/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "paths": {
      "@worker/*": ["./src/*"],
      "@/lib/*": ["../lib/*"],
      "@/types/*": ["../types/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

File: `worker/.env.example`

```bash
# worker/.env.example

# --- Supabase (service role — full access) ---
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# --- Redis (optional — falls back to polling if not set) ---
REDIS_URL=redis://localhost:6379

# --- AI Providers ---
GOOGLE_AI_API_KEY=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
COHERE_API_KEY=

# --- Worker Config ---
WORKER_PORT=3001
WORKER_CONCURRENCY=2
PIPELINE_MAX_RETRIES=3
PIPELINE_RETRY_DELAY_MS=5000

# --- Rate Limits (requests per minute) ---
RATE_LIMIT_GOOGLE=300
RATE_LIMIT_OPENAI=60
RATE_LIMIT_COHERE=100

# --- Embedding Config ---
EMBEDDING_MODEL=text-embedding-004
EMBEDDING_DIMENSIONS=768
VISUAL_EMBEDDING_MODEL=multimodalembedding@001
VISUAL_EMBEDDING_DIMENSIONS=1408
EMBEDDING_BATCH_SIZE=100

# --- Chat Config ---
CHAT_MODEL=gemini-2.0-flash
CHAT_MAX_TOOL_ITERATIONS=5
CHAT_MAX_CONTEXT_TOKENS=100000
```

```bash
cd worker && pnpm install
```

### Step 2: Create pipeline stage definitions

File: `worker/src/pipeline/stages.ts`

```typescript
// worker/src/pipeline/stages.ts
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
    description: 'Generate 768d text embeddings for all chunks',
    dependsOn: [PipelineStage.CONTEXTUAL_HEADERS],
    estimatedCostPerPage: 0.0001,
    idempotent: true,
    maxRetries: 3,
  },
  {
    stage: PipelineStage.VISUAL_EMBED,
    label: 'Visual Embedding',
    description: 'Generate 1408d visual + description embeddings for images',
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
  }
  return map[stage]
}
```

### Step 3: Create the job queue

File: `worker/src/pipeline/job-queue.ts`

```typescript
// worker/src/pipeline/job-queue.ts
// Job queue with BullMQ (Redis) primary and polling-based fallback.

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

// --- Job type definitions ---

export const JobTypeSchema = z.enum([
  'process_document',
  'process_image',
  'process_video',
  'process_audio',
  'process_hint',
  'run_cascade',
  'merge_entities',
  'detect_patterns',
])

export type JobType = z.infer<typeof JobTypeSchema>

export interface Job {
  id: string
  documentId: string | null
  jobType: JobType
  status: 'pending' | 'processing' | 'complete' | 'failed'
  priority: number
  attempts: number
  maxAttempts: number
  errorMessage: string | null
  startedAt: Date | null
  completedAt: Date | null
  createdAt: Date
}

export interface JobQueueConfig {
  redisUrl?: string
  supabaseUrl: string
  supabaseServiceKey: string
  concurrency: number
  pollIntervalMs: number
}

// --- Polling-based queue (no Redis required) ---

export class PollingJobQueue {
  private supabase: SupabaseClient
  private concurrency: number
  private pollIntervalMs: number
  private activeJobs: number = 0
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private handler: ((job: Job) => Promise<void>) | null = null
  private isShuttingDown = false

  constructor(config: JobQueueConfig) {
    this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey)
    this.concurrency = config.concurrency
    this.pollIntervalMs = config.pollIntervalMs
  }

  /** Register a handler function for processing jobs */
  onJob(handler: (job: Job) => Promise<void>): void {
    this.handler = handler
  }

  /** Start polling for new jobs */
  start(): void {
    if (this.pollTimer) return
    console.log(
      `[JobQueue] Starting polling (interval=${this.pollIntervalMs}ms, concurrency=${this.concurrency})`
    )
    this.pollTimer = setInterval(() => this.poll(), this.pollIntervalMs)
    // Run immediately on start
    this.poll()
  }

  /** Stop polling and wait for active jobs to finish */
  async stop(): Promise<void> {
    this.isShuttingDown = true
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
    // Wait for active jobs to complete (max 30s)
    const start = Date.now()
    while (this.activeJobs > 0 && Date.now() - start < 30_000) {
      await new Promise((r) => setTimeout(r, 500))
    }
    console.log('[JobQueue] Stopped')
  }

  /** Enqueue a new job */
  async enqueue(
    jobType: JobType,
    documentId: string | null,
    priority: number = 0
  ): Promise<string> {
    const { data, error } = await this.supabase
      .from('processing_jobs')
      .insert({
        document_id: documentId,
        job_type: jobType,
        status: 'pending',
        priority,
        attempts: 0,
        max_attempts: 3,
      })
      .select('id')
      .single()

    if (error) throw new Error(`Failed to enqueue job: ${error.message}`)
    return data.id
  }

  /** Poll for pending jobs, claim one, and process it */
  private async poll(): Promise<void> {
    if (this.isShuttingDown) return
    if (this.activeJobs >= this.concurrency) return
    if (!this.handler) return

    try {
      // Claim the highest-priority pending job atomically
      const { data: job, error } = await this.supabase
        .rpc('claim_next_job', { worker_id: process.pid.toString() })

      if (error) {
        // RPC may not exist yet — fall back to simple select+update
        await this.pollFallback()
        return
      }

      if (!job) return // No pending jobs

      this.activeJobs++

      const mappedJob: Job = {
        id: job.id,
        documentId: job.document_id,
        jobType: job.job_type as JobType,
        status: 'processing',
        priority: job.priority,
        attempts: job.attempts,
        maxAttempts: job.max_attempts,
        errorMessage: null,
        startedAt: new Date(),
        completedAt: null,
        createdAt: new Date(job.created_at),
      }

      try {
        await this.handler(mappedJob)
        await this.markComplete(mappedJob.id)
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        await this.markFailed(
          mappedJob.id,
          errorMsg,
          mappedJob.attempts + 1,
          mappedJob.maxAttempts
        )
      } finally {
        this.activeJobs--
      }
    } catch (err) {
      console.error('[JobQueue] Poll error:', err)
    }
  }

  /** Fallback polling without the claim_next_job RPC */
  private async pollFallback(): Promise<void> {
    const { data: jobs, error } = await this.supabase
      .from('processing_jobs')
      .select('*')
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(1)

    if (error || !jobs || jobs.length === 0) return

    const job = jobs[0]

    // Try to claim it (optimistic — may race with another worker)
    const { error: updateError } = await this.supabase
      .from('processing_jobs')
      .update({
        status: 'processing',
        started_at: new Date().toISOString(),
        attempts: job.attempts + 1,
      })
      .eq('id', job.id)
      .eq('status', 'pending') // Only update if still pending (poor-man's CAS)

    if (updateError) return

    this.activeJobs++

    const mappedJob: Job = {
      id: job.id,
      documentId: job.document_id,
      jobType: job.job_type as JobType,
      status: 'processing',
      priority: job.priority,
      attempts: job.attempts + 1,
      maxAttempts: job.max_attempts,
      errorMessage: null,
      startedAt: new Date(),
      completedAt: null,
      createdAt: new Date(job.created_at),
    }

    try {
      if (this.handler) await this.handler(mappedJob)
      await this.markComplete(mappedJob.id)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      await this.markFailed(mappedJob.id, errorMsg, mappedJob.attempts, mappedJob.maxAttempts)
    } finally {
      this.activeJobs--
    }
  }

  private async markComplete(jobId: string): Promise<void> {
    await this.supabase
      .from('processing_jobs')
      .update({ status: 'complete', completed_at: new Date().toISOString() })
      .eq('id', jobId)
  }

  private async markFailed(
    jobId: string,
    errorMessage: string,
    attempts: number,
    maxAttempts: number
  ): Promise<void> {
    const shouldRetry = attempts < maxAttempts
    await this.supabase
      .from('processing_jobs')
      .update({
        status: shouldRetry ? 'pending' : 'failed',
        error_message: errorMessage,
        completed_at: shouldRetry ? null : new Date().toISOString(),
      })
      .eq('id', jobId)
  }
}

// --- BullMQ-based queue (requires Redis) ---

export class BullMQJobQueue {
  private redisUrl: string
  private supabase: SupabaseClient
  private worker: any = null
  private queue: any = null

  constructor(config: JobQueueConfig) {
    if (!config.redisUrl) throw new Error('BullMQ requires REDIS_URL')
    this.redisUrl = config.redisUrl
    this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey)
  }

  async initialize(): Promise<void> {
    const { Queue } = await import('bullmq')
    const IORedis = (await import('ioredis')).default
    const connection = new IORedis(this.redisUrl, { maxRetriesPerRequest: null })
    this.queue = new Queue('document-pipeline', { connection })
    console.log('[JobQueue] BullMQ initialized with Redis')
  }

  onJob(handler: (job: Job) => Promise<void>): void {
    ;(this as any)._handler = handler
  }

  async start(): Promise<void> {
    const { Worker } = await import('bullmq')
    const IORedis = (await import('ioredis')).default
    const connection = new IORedis(this.redisUrl, { maxRetriesPerRequest: null })

    this.worker = new Worker(
      'document-pipeline',
      async (bullJob) => {
        const handler = (this as any)._handler
        if (!handler) return

        const job: Job = {
          id: bullJob.id || '',
          documentId: bullJob.data.documentId,
          jobType: bullJob.data.jobType,
          status: 'processing',
          priority: bullJob.opts.priority || 0,
          attempts: bullJob.attemptsMade,
          maxAttempts: 3,
          errorMessage: null,
          startedAt: new Date(),
          completedAt: null,
          createdAt: new Date(),
        }

        await handler(job)
      },
      { connection, concurrency: 2 }
    )

    console.log('[JobQueue] BullMQ worker started')
  }

  async stop(): Promise<void> {
    if (this.worker) await this.worker.close()
    if (this.queue) await this.queue.close()
  }

  async enqueue(
    jobType: JobType,
    documentId: string | null,
    priority: number = 0
  ): Promise<string> {
    if (!this.queue) throw new Error('Queue not initialized')
    const bullJob = await this.queue.add(
      jobType,
      { jobType, documentId },
      { priority, attempts: 3, backoff: { type: 'exponential', delay: 5000 } }
    )
    return bullJob.id || ''
  }
}

/**
 * Factory: create the appropriate queue based on config.
 * Returns PollingJobQueue if no Redis URL, BullMQJobQueue otherwise.
 */
export async function createJobQueue(
  config: JobQueueConfig
): Promise<PollingJobQueue | BullMQJobQueue> {
  if (config.redisUrl) {
    const queue = new BullMQJobQueue(config)
    await queue.initialize()
    return queue
  }
  return new PollingJobQueue(config)
}
```

### Step 4: Create the pipeline orchestrator

File: `worker/src/pipeline/orchestrator.ts`

```typescript
// worker/src/pipeline/orchestrator.ts
// Runs a document through all pipeline stages sequentially.
// Each stage is a function that takes a document ID and returns void.
// The orchestrator handles retries, status updates, and error reporting.

import { SupabaseClient } from '@supabase/supabase-js'
import {
  PipelineStage,
  STAGE_DEFINITIONS,
  getOrderedStages,
  stageToStatus,
  PROCESSING_STATUS,
} from './stages.js'

export interface StageHandler {
  (documentId: string, supabase: SupabaseClient): Promise<void>
}

export interface PipelineConfig {
  maxRetries: number
  retryDelayMs: number
  /** If set, only run these stages (for partial re-processing) */
  stagesFilter?: PipelineStage[]
}

export interface StageResult {
  stage: PipelineStage
  success: boolean
  durationMs: number
  error?: string
  retries: number
}

export interface PipelineResult {
  documentId: string
  success: boolean
  stages: StageResult[]
  totalDurationMs: number
}

export class PipelineOrchestrator {
  private handlers = new Map<PipelineStage, StageHandler>()
  private supabase: SupabaseClient
  private config: PipelineConfig

  constructor(supabase: SupabaseClient, config: PipelineConfig) {
    this.supabase = supabase
    this.config = config
  }

  /** Register a handler for a pipeline stage */
  registerStage(stage: PipelineStage, handler: StageHandler): void {
    this.handlers.set(stage, handler)
  }

  /** Run the full pipeline for a document */
  async processDocument(documentId: string): Promise<PipelineResult> {
    const startTime = Date.now()
    const results: StageResult[] = []
    let allSucceeded = true

    console.log(`[Pipeline] Starting processing for document ${documentId}`)

    // Get ordered stages, optionally filtered
    let stages = getOrderedStages()
    if (this.config.stagesFilter) {
      const filterSet = new Set(this.config.stagesFilter)
      stages = stages.filter((s) => filterSet.has(s))
    }

    for (const stage of stages) {
      const handler = this.handlers.get(stage)
      if (!handler) {
        console.warn(`[Pipeline] No handler registered for stage: ${stage}, skipping`)
        continue
      }

      const stageDef = STAGE_DEFINITIONS.find((d) => d.stage === stage)
      const maxRetries = stageDef?.maxRetries ?? this.config.maxRetries

      // Update processing status
      await this.updateDocumentStatus(documentId, stageToStatus(stage))

      const stageResult = await this.runStageWithRetry(
        stage,
        handler,
        documentId,
        maxRetries
      )

      results.push(stageResult)

      if (!stageResult.success) {
        allSucceeded = false
        console.error(
          `[Pipeline] Stage ${stage} failed for document ${documentId}: ${stageResult.error}`
        )
        await this.updateDocumentStatus(
          documentId,
          PROCESSING_STATUS.FAILED,
          stageResult.error
        )
        break
      }

      console.log(
        `[Pipeline] Stage ${stage} completed for document ${documentId} (${stageResult.durationMs}ms)`
      )
    }

    if (allSucceeded) {
      await this.updateDocumentStatus(documentId, PROCESSING_STATUS.COMPLETE)
    }

    const totalDurationMs = Date.now() - startTime
    console.log(
      `[Pipeline] Document ${documentId} ${allSucceeded ? 'completed' : 'failed'} in ${totalDurationMs}ms`
    )

    return { documentId, success: allSucceeded, stages: results, totalDurationMs }
  }

  /** Run a single stage with retry logic */
  private async runStageWithRetry(
    stage: PipelineStage,
    handler: StageHandler,
    documentId: string,
    maxRetries: number
  ): Promise<StageResult> {
    let lastError: string | undefined
    let retries = 0
    const startTime = Date.now()

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await handler(documentId, this.supabase)
        return {
          stage,
          success: true,
          durationMs: Date.now() - startTime,
          retries: attempt,
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err)
        retries = attempt
        console.warn(
          `[Pipeline] Stage ${stage} attempt ${attempt + 1}/${maxRetries + 1} failed: ${lastError}`
        )
        if (attempt < maxRetries) {
          const delay = 5000 * Math.pow(2, attempt)
          await new Promise((r) => setTimeout(r, delay))
        }
      }
    }

    return {
      stage,
      success: false,
      durationMs: Date.now() - startTime,
      error: lastError,
      retries,
    }
  }

  /** Update the processing_status on the documents table */
  private async updateDocumentStatus(
    documentId: string,
    status: string,
    errorMessage?: string
  ): Promise<void> {
    const update: Record<string, unknown> = {
      processing_status: status,
      updated_at: new Date().toISOString(),
    }
    if (errorMessage) {
      update.processing_error = errorMessage
    }
    if (status === PROCESSING_STATUS.COMPLETE) {
      update.processing_error = null
    }

    const { error } = await this.supabase
      .from('documents')
      .update(update)
      .eq('id', documentId)

    if (error) {
      console.error(`[Pipeline] Failed to update document status: ${error.message}`)
    }
  }
}
```

### Step 5: Create the worker entry point

File: `worker/src/index.ts`

```typescript
// worker/src/index.ts
// Main entry point for the worker process.
// Sets up Express server (for chat API), job queue, and pipeline.

import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { createClient } from '@supabase/supabase-js'
import { createJobQueue, type Job } from './pipeline/job-queue.js'
import { PipelineOrchestrator } from './pipeline/orchestrator.js'
import { PipelineStage } from './pipeline/stages.js'

// --- Import stage handlers ---
import { handleOCR } from './services/document-ai-ocr.js'
import { handleClassify } from './services/classifier.js'
import { handleChunk } from './services/smart-chunker.js'
import { handleContextualHeaders } from './services/contextual-header-gen.js'
import { handleEmbed } from './services/embedding-service.js'
import { handleVisualEmbed } from './services/visual-embedding-service.js'
import { handleEntityExtract } from './services/entity-extractor.js'
import { handleRelationshipMap } from './services/relationship-mapper.js'
import { handleRedactionDetect } from './services/redaction-detector.js'
import { handleTimelineExtract } from './services/timeline-extractor.js'
import { handleSummarize } from './services/document-summarizer.js'
import { handleCriminalIndicators } from './services/criminal-indicator-scorer.js'

// --- Import API routes ---
import { createChatRouter } from './api/chat.js'

// --- Environment validation ---
const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`)
    process.exit(1)
  }
}

const PORT = parseInt(process.env.WORKER_PORT || '3001', 10)
const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '2', 10)

async function main() {
  // --- Supabase client (service role) ---
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // --- Express server ---
  const app = express()
  app.use(cors())
  app.use(express.json({ limit: '10mb' }))

  // Health check
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      activeJobs: 0,
    })
  })

  // Chat API
  app.use('/chat', createChatRouter(supabase))

  // --- Pipeline orchestrator ---
  const pipeline = new PipelineOrchestrator(supabase, {
    maxRetries: parseInt(process.env.PIPELINE_MAX_RETRIES || '3', 10),
    retryDelayMs: parseInt(process.env.PIPELINE_RETRY_DELAY_MS || '5000', 10),
  })

  // Register all stage handlers
  pipeline.registerStage(PipelineStage.OCR, handleOCR)
  pipeline.registerStage(PipelineStage.CLASSIFY, handleClassify)
  pipeline.registerStage(PipelineStage.CHUNK, handleChunk)
  pipeline.registerStage(PipelineStage.CONTEXTUAL_HEADERS, handleContextualHeaders)
  pipeline.registerStage(PipelineStage.EMBED, handleEmbed)
  pipeline.registerStage(PipelineStage.VISUAL_EMBED, handleVisualEmbed)
  pipeline.registerStage(PipelineStage.ENTITY_EXTRACT, handleEntityExtract)
  pipeline.registerStage(PipelineStage.RELATIONSHIP_MAP, handleRelationshipMap)
  pipeline.registerStage(PipelineStage.REDACTION_DETECT, handleRedactionDetect)
  pipeline.registerStage(PipelineStage.TIMELINE_EXTRACT, handleTimelineExtract)
  pipeline.registerStage(PipelineStage.SUMMARIZE, handleSummarize)
  pipeline.registerStage(PipelineStage.CRIMINAL_INDICATORS, handleCriminalIndicators)

  // --- Job queue ---
  const jobQueue = await createJobQueue({
    redisUrl: process.env.REDIS_URL,
    supabaseUrl: process.env.SUPABASE_URL!,
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    concurrency: CONCURRENCY,
    pollIntervalMs: 5000,
  })

  jobQueue.onJob(async (job: Job) => {
    console.log(`[Worker] Processing job ${job.id} (type=${job.jobType}, doc=${job.documentId})`)

    switch (job.jobType) {
      case 'process_document':
        if (!job.documentId) throw new Error('process_document requires documentId')
        await pipeline.processDocument(job.documentId)
        break

      case 'process_image':
        if (!job.documentId) throw new Error('process_image requires documentId')
        await handleVisualEmbed(job.documentId, supabase)
        break

      case 'process_video':
        console.log(`[Worker] Video processing for ${job.documentId}`)
        break

      case 'process_audio':
        console.log(`[Worker] Audio processing for ${job.documentId}`)
        break

      case 'process_hint':
        console.log(`[Worker] Hint processing for ${job.documentId}`)
        break

      case 'run_cascade':
        console.log(`[Worker] Cascade processing`)
        break

      case 'merge_entities':
        console.log(`[Worker] Entity merge detection`)
        break

      case 'detect_patterns':
        console.log(`[Worker] Pattern detection`)
        break

      default:
        console.warn(`[Worker] Unknown job type: ${job.jobType}`)
    }
  })

  jobQueue.start()

  // --- Graceful shutdown ---
  const shutdown = async () => {
    console.log('[Worker] Shutting down...')
    await jobQueue.stop()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  // --- Start Express ---
  app.listen(PORT, () => {
    console.log(`[Worker] Express server listening on port ${PORT}`)
    console.log(`[Worker] Health check: http://localhost:${PORT}/health`)
    console.log(`[Worker] Chat API:    POST http://localhost:${PORT}/chat`)
    console.log(`[Worker] Concurrency: ${CONCURRENCY}`)
    console.log(`[Worker] Redis:       ${process.env.REDIS_URL ? 'BullMQ' : 'Polling fallback'}`)
  })
}

main().catch((err) => {
  console.error('[Worker] Fatal error:', err)
  process.exit(1)
})
```

### Step 6: Build Stage 1 — OCR service

File: `worker/src/services/document-ai-ocr.ts`

```typescript
// worker/src/services/document-ai-ocr.ts
// Stage 1: OCR — Extract text from PDF/image documents.
// Uses Gemini Vision for OCR (simpler than Document AI, supports all formats).

import { SupabaseClient } from '@supabase/supabase-js'

// --- Types ---

interface OCRPage {
  pageNumber: number
  text: string
  confidence: number
  width: number
  height: number
}

interface OCRResult {
  fullText: string
  pages: OCRPage[]
  averageConfidence: number
  pageCount: number
}

// --- Google Gemini Vision OCR ---

async function runOCR(
  fileBuffer: Buffer,
  mimeType: string,
  apiKey: string
): Promise<OCRResult> {
  const base64Content = fileBuffer.toString('base64')

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inlineData: { mimeType, data: base64Content } },
              {
                text: `Extract ALL text from this document. Format as markdown:
- Use ## for section headings you identify
- Use ### for subsections
- Preserve paragraph breaks
- Mark any tables using markdown table syntax
- Mark redacted/blacked-out areas as [REDACTED]
- Include page numbers as "--- Page N ---" separators if multiple pages

Return ONLY the extracted text, no commentary.`,
              },
            ],
          },
        ],
        generationConfig: { temperature: 0.1, maxOutputTokens: 65536 },
      }),
    }
  )

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Google AI OCR failed (${response.status}): ${errText}`)
  }

  const data = await response.json()
  const fullText = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

  // Parse pages from "--- Page N ---" markers
  const pageTexts = fullText.split(/---\s*Page\s+\d+\s*---/)
  const pages: OCRPage[] = pageTexts
    .filter((t: string) => t.trim().length > 0)
    .map((text: string, i: number) => ({
      pageNumber: i + 1,
      text: text.trim(),
      confidence: 0.85,
      width: 0,
      height: 0,
    }))

  if (pages.length === 0 && fullText.trim().length > 0) {
    pages.push({
      pageNumber: 1,
      text: fullText.trim(),
      confidence: 0.85,
      width: 0,
      height: 0,
    })
  }

  return {
    fullText,
    pages,
    averageConfidence: 0.85,
    pageCount: pages.length,
  }
}

// --- Stage handler ---

export async function handleOCR(
  documentId: string,
  supabase: SupabaseClient
): Promise<void> {
  console.log(`[OCR] Processing document ${documentId}`)

  // 1. Fetch document metadata
  const { data: doc, error: docError } = await supabase
    .from('documents')
    .select('id, filename, file_type, mime_type, storage_path')
    .eq('id', documentId)
    .single()

  if (docError || !doc) throw new Error(`Document not found: ${documentId}`)

  // 2. Download file from Supabase Storage
  const { data: fileData, error: dlError } = await supabase.storage
    .from('documents')
    .download(doc.storage_path)

  if (dlError || !fileData) {
    throw new Error(`Failed to download file: ${dlError?.message}`)
  }

  const fileBuffer = Buffer.from(await fileData.arrayBuffer())
  const mimeType = doc.mime_type || 'application/pdf'

  // 3. Run OCR
  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) throw new Error('GOOGLE_AI_API_KEY not set')

  const result = await runOCR(fileBuffer, mimeType, apiKey)

  // 4. Update document with OCR text
  const { error: updateError } = await supabase
    .from('documents')
    .update({
      ocr_text: result.fullText,
      page_count: result.pageCount,
      metadata: {
        ocr_confidence: result.averageConfidence,
        ocr_page_count: result.pageCount,
        ocr_timestamp: new Date().toISOString(),
      },
    })
    .eq('id', documentId)

  if (updateError) {
    throw new Error(`Failed to update document with OCR text: ${updateError.message}`)
  }

  console.log(
    `[OCR] Document ${documentId}: extracted ${result.fullText.length} chars from ${result.pageCount} pages`
  )
}
```

### Step 7: Build Stage 2 — Document classifier

File: `worker/src/services/classifier.ts`

```typescript
// worker/src/services/classifier.ts
// Stage 2: Classification — Classify documents into one of 16 types.
// Uses Gemini Flash with structured JSON output.

import { SupabaseClient } from '@supabase/supabase-js'

export const DOCUMENT_TYPES = [
  'deposition',
  'flight_log',
  'financial_record',
  'police_report',
  'court_filing',
  'correspondence',
  'phone_record',
  'address_book',
  'fbi_report',
  'grand_jury_testimony',
  'witness_statement',
  'property_record',
  'medical_record',
  'photograph',
  'news_clipping',
  'other',
] as const

export type DocumentType = (typeof DOCUMENT_TYPES)[number]

interface ClassificationResult {
  type: DocumentType
  confidence: number
  reasoning: string
}

async function classifyDocument(
  ocrText: string,
  filename: string,
  apiKey: string
): Promise<ClassificationResult> {
  // Use first 3000 + last 1000 chars (saves tokens on long documents)
  const textSample =
    ocrText.length > 4000
      ? ocrText.slice(0, 3000) + '\n...\n' + ocrText.slice(-1000)
      : ocrText

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Classify this document into exactly one of these types:
${DOCUMENT_TYPES.map((t) => `- ${t}`).join('\n')}

Filename: ${filename}

Document text (excerpt):
---
${textSample}
---

Respond with JSON only:
{
  "type": "<one of the types above>",
  "confidence": <0.0-1.0>,
  "reasoning": "<1 sentence explaining why>"
}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 256,
          responseMimeType: 'application/json',
        },
      }),
    }
  )

  if (!response.ok) {
    throw new Error(`Classification API failed: ${response.status}`)
  }

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'

  try {
    const parsed = JSON.parse(text)
    const docType = DOCUMENT_TYPES.includes(parsed.type) ? parsed.type : 'other'
    return {
      type: docType as DocumentType,
      confidence: Math.min(1.0, Math.max(0.0, parsed.confidence || 0.5)),
      reasoning: parsed.reasoning || '',
    }
  } catch {
    return {
      type: 'other',
      confidence: 0.3,
      reasoning: 'Failed to parse classification response',
    }
  }
}

// --- Stage handler ---

export async function handleClassify(
  documentId: string,
  supabase: SupabaseClient
): Promise<void> {
  console.log(`[Classify] Processing document ${documentId}`)

  const { data: doc, error } = await supabase
    .from('documents')
    .select('id, filename, ocr_text')
    .eq('id', documentId)
    .single()

  if (error || !doc) throw new Error(`Document not found: ${documentId}`)
  if (!doc.ocr_text) throw new Error(`Document ${documentId} has no OCR text — run OCR first`)

  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) throw new Error('GOOGLE_AI_API_KEY not set')

  const result = await classifyDocument(doc.ocr_text, doc.filename, apiKey)

  const { error: updateError } = await supabase
    .from('documents')
    .update({
      classification: result.type,
      classification_confidence: result.confidence,
      metadata: {
        classification_reasoning: result.reasoning,
        classification_timestamp: new Date().toISOString(),
      },
    })
    .eq('id', documentId)

  if (updateError) {
    throw new Error(`Failed to update classification: ${updateError.message}`)
  }

  console.log(
    `[Classify] Document ${documentId}: ${result.type} (confidence: ${result.confidence.toFixed(2)})`
  )
}
```

### Step 8: Build Stage 3 — Smart chunker

File: `worker/src/services/smart-chunker.ts`

```typescript
// worker/src/services/smart-chunker.ts
// Stage 3: Structure-aware chunking.
// Splits OCR text into 800-1500 char chunks respecting heading/section boundaries.
// No API calls — pure text processing.

import { SupabaseClient } from '@supabase/supabase-js'

// --- Types ---

interface ChunkData {
  chunkIndex: number
  content: string
  pageNumber: number | null
  sectionTitle: string | null
  hierarchyPath: string[]
  charCount: number
  tokenCountEstimate: number
}

interface ChunkingConfig {
  minChunkSize: number
  maxChunkSize: number
  targetChunkSize: number
  overlapChars: number
}

const DEFAULT_CONFIG: ChunkingConfig = {
  minChunkSize: 400,
  maxChunkSize: 1500,
  targetChunkSize: 1000,
  overlapChars: 100,
}

// --- Section parsing ---

interface Section {
  title: string
  level: number
  content: string
  pageNumber: number | null
}

function parseSections(text: string): Section[] {
  const lines = text.split('\n')
  const sections: Section[] = []
  let currentSection: Section = {
    title: 'Document Start',
    level: 1,
    content: '',
    pageNumber: 1,
  }
  let currentPage = 1

  for (const line of lines) {
    const pageMatch = line.match(/---\s*Page\s+(\d+)\s*---/)
    if (pageMatch) {
      currentPage = parseInt(pageMatch[1], 10)
      continue
    }

    const headingMatch = line.match(/^(#{1,4})\s+(.+)/)
    if (headingMatch) {
      if (currentSection.content.trim().length > 0) {
        sections.push({ ...currentSection })
      }
      currentSection = {
        title: headingMatch[2].trim(),
        level: headingMatch[1].length,
        content: '',
        pageNumber: currentPage,
      }
      continue
    }

    currentSection.content += line + '\n'
    currentSection.pageNumber = currentSection.pageNumber || currentPage
  }

  if (currentSection.content.trim().length > 0) {
    sections.push(currentSection)
  }

  return sections
}

function buildHierarchyPath(sections: Section[], currentIndex: number): string[] {
  const path: string[] = []
  const currentLevel = sections[currentIndex].level

  for (let i = currentIndex; i >= 0; i--) {
    if (sections[i].level < currentLevel || i === currentIndex) {
      if (sections[i].level <= (path.length > 0 ? sections[currentIndex].level : Infinity)) {
        path.unshift(sections[i].title)
      }
    }
    if (sections[i].level === 1 && i !== currentIndex) break
  }

  return path
}

function splitSectionIntoChunks(
  section: Section,
  hierarchyPath: string[],
  startIndex: number,
  config: ChunkingConfig
): ChunkData[] {
  const chunks: ChunkData[] = []
  const text = section.content.trim()

  if (text.length === 0) return chunks

  if (text.length <= config.maxChunkSize) {
    chunks.push({
      chunkIndex: startIndex,
      content: text,
      pageNumber: section.pageNumber,
      sectionTitle: section.title,
      hierarchyPath,
      charCount: text.length,
      tokenCountEstimate: Math.ceil(text.length / 4),
    })
    return chunks
  }

  const paragraphs = text.split(/\n\s*\n/)
  let currentChunk = ''
  let chunkIdx = startIndex

  for (const para of paragraphs) {
    const trimmedPara = para.trim()
    if (trimmedPara.length === 0) continue

    if (
      currentChunk.length + trimmedPara.length + 2 > config.maxChunkSize &&
      currentChunk.length > 0
    ) {
      chunks.push({
        chunkIndex: chunkIdx++,
        content: currentChunk.trim(),
        pageNumber: section.pageNumber,
        sectionTitle: section.title,
        hierarchyPath,
        charCount: currentChunk.trim().length,
        tokenCountEstimate: Math.ceil(currentChunk.trim().length / 4),
      })
      const overlap = currentChunk.slice(-config.overlapChars)
      currentChunk = overlap + '\n\n'
    }

    if (trimmedPara.length > config.maxChunkSize) {
      if (currentChunk.length > 0) {
        chunks.push({
          chunkIndex: chunkIdx++,
          content: currentChunk.trim(),
          pageNumber: section.pageNumber,
          sectionTitle: section.title,
          hierarchyPath,
          charCount: currentChunk.trim().length,
          tokenCountEstimate: Math.ceil(currentChunk.trim().length / 4),
        })
        currentChunk = ''
      }

      const sentences = trimmedPara.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [trimmedPara]
      for (const sentence of sentences) {
        if (
          currentChunk.length + sentence.length > config.maxChunkSize &&
          currentChunk.length > 0
        ) {
          chunks.push({
            chunkIndex: chunkIdx++,
            content: currentChunk.trim(),
            pageNumber: section.pageNumber,
            sectionTitle: section.title,
            hierarchyPath,
            charCount: currentChunk.trim().length,
            tokenCountEstimate: Math.ceil(currentChunk.trim().length / 4),
          })
          currentChunk = ''
        }
        currentChunk += sentence
      }
    } else {
      currentChunk += (currentChunk.length > 0 ? '\n\n' : '') + trimmedPara
    }
  }

  if (currentChunk.trim().length >= config.minChunkSize) {
    chunks.push({
      chunkIndex: chunkIdx++,
      content: currentChunk.trim(),
      pageNumber: section.pageNumber,
      sectionTitle: section.title,
      hierarchyPath,
      charCount: currentChunk.trim().length,
      tokenCountEstimate: Math.ceil(currentChunk.trim().length / 4),
    })
  } else if (currentChunk.trim().length > 0 && chunks.length > 0) {
    const lastChunk = chunks[chunks.length - 1]
    lastChunk.content += '\n\n' + currentChunk.trim()
    lastChunk.charCount = lastChunk.content.length
    lastChunk.tokenCountEstimate = Math.ceil(lastChunk.content.length / 4)
  } else if (currentChunk.trim().length > 0) {
    chunks.push({
      chunkIndex: chunkIdx++,
      content: currentChunk.trim(),
      pageNumber: section.pageNumber,
      sectionTitle: section.title,
      hierarchyPath,
      charCount: currentChunk.trim().length,
      tokenCountEstimate: Math.ceil(currentChunk.trim().length / 4),
    })
  }

  return chunks
}

export function chunkDocument(
  ocrText: string,
  config: ChunkingConfig = DEFAULT_CONFIG
): ChunkData[] {
  const sections = parseSections(ocrText)
  const allChunks: ChunkData[] = []
  let chunkIndex = 0

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i]
    const hierarchyPath = buildHierarchyPath(sections, i)
    const sectionChunks = splitSectionIntoChunks(
      section,
      hierarchyPath,
      chunkIndex,
      config
    )
    allChunks.push(...sectionChunks)
    chunkIndex += sectionChunks.length
  }

  allChunks.forEach((chunk, i) => {
    chunk.chunkIndex = i
  })

  return allChunks
}

// --- Stage handler ---

export async function handleChunk(
  documentId: string,
  supabase: SupabaseClient
): Promise<void> {
  console.log(`[Chunker] Processing document ${documentId}`)

  const { data: doc, error } = await supabase
    .from('documents')
    .select('id, ocr_text')
    .eq('id', documentId)
    .single()

  if (error || !doc) throw new Error(`Document not found: ${documentId}`)
  if (!doc.ocr_text) throw new Error(`Document ${documentId} has no OCR text`)

  // Delete existing chunks (idempotent)
  await supabase.from('chunks').delete().eq('document_id', documentId)

  const chunks = chunkDocument(doc.ocr_text)

  if (chunks.length === 0) {
    console.warn(`[Chunker] Document ${documentId}: no chunks generated`)
    return
  }

  // Insert in batches of 50
  const BATCH_SIZE = 50
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE).map((chunk) => ({
      document_id: documentId,
      chunk_index: chunk.chunkIndex,
      content: chunk.content,
      page_number: chunk.pageNumber,
      section_title: chunk.sectionTitle,
      hierarchy_path: chunk.hierarchyPath,
      char_count: chunk.charCount,
      token_count_estimate: chunk.tokenCountEstimate,
    }))

    const { error: insertError } = await supabase.from('chunks').insert(batch)

    if (insertError) {
      throw new Error(`Failed to insert chunks batch ${i}: ${insertError.message}`)
    }
  }

  console.log(`[Chunker] Document ${documentId}: created ${chunks.length} chunks`)
}
```

### Step 9: Build Stage 4 — Contextual header generator

File: `worker/src/services/contextual-header-gen.ts`

```typescript
// worker/src/services/contextual-header-gen.ts
// Stage 4: Contextual Headers — Generate a 50-100 token context header per chunk.
// The header situates each chunk within the whole document, improving embedding quality
// and search relevance (Anthropic's "Contextual Retrieval" technique).

import { SupabaseClient } from '@supabase/supabase-js'

interface ChunkRow {
  id: string
  chunk_index: number
  content: string
  section_title: string | null
  hierarchy_path: string[] | null
}

async function generateContextualHeaders(
  chunks: ChunkRow[],
  documentSummary: string,
  filename: string,
  apiKey: string
): Promise<Map<string, string>> {
  const headers = new Map<string, string>()

  // Process in parallel batches of 10
  const BATCH_SIZE = 10
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE)

    const promises = batch.map(async (chunk) => {
      const hierarchyStr = chunk.hierarchy_path?.join(' > ') || ''
      const sectionStr = chunk.section_title || ''

      const prompt = `You are generating a short contextual header for a document chunk to improve search retrieval.

Document: "${filename}"
${documentSummary ? `Document summary: ${documentSummary}` : ''}
${hierarchyStr ? `Section path: ${hierarchyStr}` : ''}
${sectionStr ? `Section: ${sectionStr}` : ''}
Chunk ${chunk.chunk_index + 1} of ${chunks.length}:
---
${chunk.content.slice(0, 1000)}
---

Write a 50-100 token header that situates this chunk within the document. Include:
- What document this is from
- What section/topic this chunk covers
- Key entities mentioned (if any)

Format: A single paragraph, no bullet points. Be specific and factual.`

      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.2, maxOutputTokens: 150 },
            }),
          }
        )

        if (!response.ok) {
          console.warn(`[ContextHeaders] API error for chunk ${chunk.id}: ${response.status}`)
          return
        }

        const data = await response.json()
        const headerText = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
        if (headerText.trim()) {
          headers.set(chunk.id, headerText.trim())
        }
      } catch (err) {
        console.warn(`[ContextHeaders] Failed for chunk ${chunk.id}:`, err)
      }
    })

    await Promise.all(promises)
  }

  return headers
}

// --- Stage handler ---

export async function handleContextualHeaders(
  documentId: string,
  supabase: SupabaseClient
): Promise<void> {
  console.log(`[ContextHeaders] Processing document ${documentId}`)

  const { data: doc, error: docError } = await supabase
    .from('documents')
    .select('id, filename, ocr_text, classification, metadata')
    .eq('id', documentId)
    .single()

  if (docError || !doc) throw new Error(`Document not found: ${documentId}`)

  const docSummary = doc.metadata?.summary || ''
  const docType = doc.classification || 'unknown'
  const summaryStr = docSummary
    ? String(docSummary)
    : `${docType} document — ${(doc.ocr_text || '').slice(0, 200)}`

  const { data: chunks, error: chunkError } = await supabase
    .from('chunks')
    .select('id, chunk_index, content, section_title, hierarchy_path')
    .eq('document_id', documentId)
    .order('chunk_index', { ascending: true })

  if (chunkError || !chunks) throw new Error(`Failed to fetch chunks: ${chunkError?.message}`)
  if (chunks.length === 0) return

  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) throw new Error('GOOGLE_AI_API_KEY not set')

  const headers = await generateContextualHeaders(
    chunks as ChunkRow[],
    summaryStr,
    doc.filename,
    apiKey
  )

  let updatedCount = 0
  for (const [chunkId, headerText] of headers) {
    const { error: updateError } = await supabase
      .from('chunks')
      .update({ contextual_header: headerText })
      .eq('id', chunkId)

    if (!updateError) updatedCount++
  }

  console.log(
    `[ContextHeaders] Document ${documentId}: generated ${updatedCount}/${chunks.length} headers`
  )
}
```

### Step 10: Build Stage 5 — Embedding service and cache

File: `worker/src/services/embedding-cache.ts`

```typescript
// worker/src/services/embedding-cache.ts
// Two-tier embedding cache: L1 in-memory LRU + L2 Supabase lookup.
// Wraps any embedding call to avoid re-computing embeddings for identical text.

import { createHash } from 'crypto'
import { LRUCache } from 'lru-cache'

export interface EmbeddingCacheConfig {
  maxMemoryEntries: number
}

export class EmbeddingCache {
  private l1: LRUCache<string, number[]>

  constructor(config: EmbeddingCacheConfig = { maxMemoryEntries: 10_000 }) {
    this.l1 = new LRUCache<string, number[]>({ max: config.maxMemoryEntries })
  }

  static hashText(text: string): string {
    return createHash('sha256').update(text).digest('hex')
  }

  getFromMemory(textHash: string): number[] | undefined {
    return this.l1.get(textHash)
  }

  setInMemory(textHash: string, embedding: number[]): void {
    this.l1.set(textHash, embedding)
  }

  async getOrCompute(
    text: string,
    computeFn: (text: string) => Promise<number[]>
  ): Promise<number[]> {
    const hash = EmbeddingCache.hashText(text)
    const cached = this.l1.get(hash)
    if (cached) return cached

    const embedding = await computeFn(text)
    this.l1.set(hash, embedding)
    return embedding
  }

  async batchGetOrCompute(
    texts: string[],
    batchComputeFn: (texts: string[]) => Promise<number[][]>
  ): Promise<number[][]> {
    const results: (number[] | null)[] = new Array(texts.length).fill(null)
    const uncachedIndices: number[] = []
    const uncachedTexts: string[] = []

    for (let i = 0; i < texts.length; i++) {
      const hash = EmbeddingCache.hashText(texts[i])
      const cached = this.l1.get(hash)
      if (cached) {
        results[i] = cached
      } else {
        uncachedIndices.push(i)
        uncachedTexts.push(texts[i])
      }
    }

    if (uncachedTexts.length > 0) {
      const computed = await batchComputeFn(uncachedTexts)
      for (let i = 0; i < uncachedIndices.length; i++) {
        const originalIndex = uncachedIndices[i]
        results[originalIndex] = computed[i]
        const hash = EmbeddingCache.hashText(uncachedTexts[i])
        this.l1.set(hash, computed[i])
      }
    }

    return results as number[][]
  }

  stats(): { memorySize: number; maxMemory: number } {
    return { memorySize: this.l1.size, maxMemory: this.l1.max }
  }
}
```

File: `worker/src/services/embedding-service.ts`

```typescript
// worker/src/services/embedding-service.ts
// Stage 5: Text Embedding — Generate 768d embeddings for all chunks.
// Uses Google text-embedding-004 via REST API with embedding cache.

import { SupabaseClient } from '@supabase/supabase-js'
import { EmbeddingCache } from './embedding-cache.js'

async function embedTexts(texts: string[], apiKey: string): Promise<number[][]> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:batchEmbedContents?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: texts.map((text) => ({
          model: 'models/text-embedding-004',
          content: { parts: [{ text }] },
          outputDimensionality: 768,
        })),
      }),
    }
  )

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Embedding API failed (${response.status}): ${errText}`)
  }

  const data = await response.json()
  return data.embeddings.map((e: { values: number[] }) => e.values)
}

function buildEmbeddingInput(content: string, contextualHeader: string | null): string {
  if (contextualHeader) {
    return `${contextualHeader}\n\n${content}`
  }
  return content
}

// Singleton cache instance
const embeddingCache = new EmbeddingCache({ maxMemoryEntries: 10_000 })

// --- Stage handler ---

export async function handleEmbed(
  documentId: string,
  supabase: SupabaseClient
): Promise<void> {
  console.log(`[Embed] Processing document ${documentId}`)

  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) throw new Error('GOOGLE_AI_API_KEY not set')

  const { data: chunks, error } = await supabase
    .from('chunks')
    .select('id, content, contextual_header, content_embedding')
    .eq('document_id', documentId)
    .order('chunk_index', { ascending: true })

  if (error || !chunks) throw new Error(`Failed to fetch chunks: ${error?.message}`)

  const needsEmbedding = chunks.filter((c) => !c.content_embedding)
  if (needsEmbedding.length === 0) {
    console.log(`[Embed] Document ${documentId}: all chunks already embedded`)
    return
  }

  const inputs = needsEmbedding.map((c) =>
    buildEmbeddingInput(c.content, c.contextual_header)
  )

  const BATCH_SIZE = parseInt(process.env.EMBEDDING_BATCH_SIZE || '100', 10)
  let embeddedCount = 0

  for (let i = 0; i < needsEmbedding.length; i += BATCH_SIZE) {
    const batchChunks = needsEmbedding.slice(i, i + BATCH_SIZE)
    const batchInputs = inputs.slice(i, i + BATCH_SIZE)

    const embeddings = await embeddingCache.batchGetOrCompute(batchInputs, (texts) =>
      embedTexts(texts, apiKey)
    )

    for (let j = 0; j < batchChunks.length; j++) {
      const { error: updateError } = await supabase
        .from('chunks')
        .update({ content_embedding: JSON.stringify(embeddings[j]) })
        .eq('id', batchChunks[j].id)

      if (!updateError) embeddedCount++
    }

    if (i + BATCH_SIZE < needsEmbedding.length) {
      await new Promise((r) => setTimeout(r, 200))
    }
  }

  console.log(
    `[Embed] Document ${documentId}: embedded ${embeddedCount}/${needsEmbedding.length} chunks`
  )
}
```

### Step 11: Build visual embedding service

File: `worker/src/services/visual-embedding-service.ts`

```typescript
// worker/src/services/visual-embedding-service.ts
// Generates description embeddings for images extracted from documents.
// Uses Gemini Vision for descriptions, text-embedding-004 for embeddings.

import { SupabaseClient } from '@supabase/supabase-js'

async function generateImageDescription(
  imageBuffer: Buffer,
  mimeType: string,
  apiKey: string
): Promise<string> {
  const base64 = imageBuffer.toString('base64')

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inlineData: { mimeType, data: base64 } },
              {
                text: `Describe this image in detail for a research database. Include:
- Who/what is visible (people, objects, locations)
- Any visible text, labels, or captions
- Setting and context
- Any notable details relevant to a legal investigation

Be thorough but factual. 2-4 sentences.`,
              },
            ],
          },
        ],
        generationConfig: { temperature: 0.2, maxOutputTokens: 300 },
      }),
    }
  )

  if (!response.ok) {
    throw new Error(`Image description API failed: ${response.status}`)
  }

  const data = await response.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No description generated'
}

async function embedText(text: string, apiKey: string): Promise<number[]> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'models/text-embedding-004',
        content: { parts: [{ text }] },
      }),
    }
  )

  if (!response.ok) throw new Error(`Text embedding API failed: ${response.status}`)
  const data = await response.json()
  return data.embedding.values
}

// --- Stage handler ---

export async function handleVisualEmbed(
  documentId: string,
  supabase: SupabaseClient
): Promise<void> {
  console.log(`[VisualEmbed] Processing images for document ${documentId}`)

  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) throw new Error('GOOGLE_AI_API_KEY not set')

  const { data: images, error } = await supabase
    .from('images')
    .select('id, storage_path, file_type, description, description_embedding')
    .eq('document_id', documentId)

  if (error) throw new Error(`Failed to fetch images: ${error.message}`)
  if (!images || images.length === 0) {
    console.log(`[VisualEmbed] Document ${documentId}: no images found, skipping`)
    return
  }

  let processedCount = 0
  for (const image of images) {
    if (image.description_embedding) {
      processedCount++
      continue
    }

    try {
      const { data: fileData, error: dlError } = await supabase.storage
        .from('images')
        .download(image.storage_path)

      if (dlError || !fileData) {
        console.warn(`[VisualEmbed] Failed to download image ${image.id}`)
        continue
      }

      const imageBuffer = Buffer.from(await fileData.arrayBuffer())
      const mimeType = image.file_type || 'image/jpeg'

      const description =
        image.description || (await generateImageDescription(imageBuffer, mimeType, apiKey))
      const descriptionEmbedding = await embedText(description, apiKey)

      const { error: updateError } = await supabase
        .from('images')
        .update({
          description,
          description_embedding: JSON.stringify(descriptionEmbedding),
        })
        .eq('id', image.id)

      if (!updateError) processedCount++

      await new Promise((r) => setTimeout(r, 500))
    } catch (err) {
      console.warn(`[VisualEmbed] Error processing image ${image.id}:`, err)
    }
  }

  console.log(
    `[VisualEmbed] Document ${documentId}: processed ${processedCount}/${images.length} images`
  )
}
```

### Step 12: Build Stage 6 — Entity extractor

File: `worker/src/services/entity-extractor.ts`

```typescript
// worker/src/services/entity-extractor.ts
// Stage 6: Entity Extraction — Extract named entities from document chunks.
// Uses Gemini Flash with structured JSON output.
// Deduplicates against existing entities by name matching.

import { SupabaseClient } from '@supabase/supabase-js'

const ENTITY_TYPES = [
  'person',
  'organization',
  'location',
  'aircraft',
  'vessel',
  'property',
  'account',
] as const

type EntityType = (typeof ENTITY_TYPES)[number]

interface ExtractedEntity {
  name: string
  type: EntityType
  aliases: string[]
  mentionText: string
  contextSnippet: string
  confidence: number
}

interface ExtractedEntities {
  entities: ExtractedEntity[]
}

async function extractEntitiesFromChunk(
  chunkContent: string,
  documentType: string,
  apiKey: string
): Promise<ExtractedEntities> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Extract all named entities from this text chunk of a ${documentType} document.

Entity types: ${ENTITY_TYPES.join(', ')}

Text:
---
${chunkContent}
---

For each entity found, provide:
- name: The canonical name (e.g., "Jeffrey Epstein" not "Epstein" or "Mr. Epstein")
- type: One of the entity types above
- aliases: Any alternate names/forms used in the text
- mentionText: The exact text mention in the chunk
- contextSnippet: 1-2 sentences surrounding the mention
- confidence: 0.0-1.0 how confident you are this is a real entity

Return JSON:
{
  "entities": [
    {
      "name": "...",
      "type": "...",
      "aliases": ["..."],
      "mentionText": "...",
      "contextSnippet": "...",
      "confidence": 0.95
    }
  ]
}

If no entities found, return { "entities": [] }.
Be thorough — extract ALL people, organizations, locations, aircraft, vessels, properties, and accounts mentioned.`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
        },
      }),
    }
  )

  if (!response.ok) {
    throw new Error(`Entity extraction API failed: ${response.status}`)
  }

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{"entities":[]}'

  try {
    const parsed = JSON.parse(text) as ExtractedEntities
    // Validate entity types
    parsed.entities = parsed.entities.filter((e) =>
      ENTITY_TYPES.includes(e.type as EntityType)
    )
    return parsed
  } catch {
    return { entities: [] }
  }
}

/**
 * Find or create an entity in the database.
 * Matches by exact name + type first, then checks aliases.
 */
async function findOrCreateEntity(
  entity: ExtractedEntity,
  supabase: SupabaseClient
): Promise<string> {
  // Try exact match first
  const { data: existing } = await supabase
    .from('entities')
    .select('id, aliases, mention_count')
    .eq('name', entity.name)
    .eq('entity_type', entity.type)
    .single()

  if (existing) {
    // Merge aliases
    const allAliases = new Set([...(existing.aliases || []), ...entity.aliases])
    await supabase
      .from('entities')
      .update({
        aliases: Array.from(allAliases),
        mention_count: (existing.mention_count || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)

    return existing.id
  }

  // Create new entity
  const { data: created, error } = await supabase
    .from('entities')
    .insert({
      name: entity.name,
      entity_type: entity.type,
      aliases: entity.aliases,
      mention_count: 1,
      metadata: {},
    })
    .select('id')
    .single()

  if (error) throw new Error(`Failed to create entity: ${error.message}`)
  return created.id
}

// --- Stage handler ---

export async function handleEntityExtract(
  documentId: string,
  supabase: SupabaseClient
): Promise<void> {
  console.log(`[EntityExtract] Processing document ${documentId}`)

  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) throw new Error('GOOGLE_AI_API_KEY not set')

  // Get document type for context
  const { data: doc } = await supabase
    .from('documents')
    .select('classification')
    .eq('id', documentId)
    .single()

  const documentType = doc?.classification || 'unknown'

  // Get all chunks
  const { data: chunks, error } = await supabase
    .from('chunks')
    .select('id, content, page_number')
    .eq('document_id', documentId)
    .order('chunk_index', { ascending: true })

  if (error || !chunks) throw new Error(`Failed to fetch chunks: ${error?.message}`)

  let totalEntities = 0
  let totalMentions = 0
  const documentEntityIds = new Set<string>()

  for (const chunk of chunks) {
    try {
      const extracted = await extractEntitiesFromChunk(
        chunk.content,
        documentType,
        apiKey
      )

      for (const entity of extracted.entities) {
        if (entity.confidence < 0.5) continue // Skip low-confidence

        const entityId = await findOrCreateEntity(entity, supabase)
        documentEntityIds.add(entityId)

        // Create entity_mention
        const { error: mentionError } = await supabase.from('entity_mentions').insert({
          entity_id: entityId,
          chunk_id: chunk.id,
          document_id: documentId,
          mention_text: entity.mentionText,
          context_snippet: entity.contextSnippet,
          mention_type: 'direct',
          confidence: entity.confidence,
          page_number: chunk.page_number,
        })

        if (!mentionError) totalMentions++
        totalEntities++
      }

      // Rate limiting between chunks
      await new Promise((r) => setTimeout(r, 200))
    } catch (err) {
      console.warn(`[EntityExtract] Error on chunk ${chunk.id}:`, err)
    }
  }

  // Update document_count on affected entities
  for (const entityId of documentEntityIds) {
    await supabase.rpc('increment_entity_document_count', { entity_id_param: entityId }).catch(() => {
      // RPC may not exist — manual update
      supabase
        .from('entities')
        .update({ document_count: documentEntityIds.size })
        .eq('id', entityId)
    })
  }

  console.log(
    `[EntityExtract] Document ${documentId}: extracted ${totalEntities} entities, ${totalMentions} mentions`
  )
}
```

### Step 13: Build Stage 7 — Relationship mapper

File: `worker/src/services/relationship-mapper.ts`

```typescript
// worker/src/services/relationship-mapper.ts
// Stage 7: Relationship Mapping — Identify entity-to-entity relationships.
// Uses Gemini Flash to analyze chunks where multiple entities co-occur.

import { SupabaseClient } from '@supabase/supabase-js'

const RELATIONSHIP_TYPES = [
  'traveled_with',
  'employed_by',
  'associate_of',
  'family_member',
  'legal_representative',
  'financial_connection',
  'communicated_with',
  'met_with',
  'referenced_together',
  'victim_of',
  'witness_against',
] as const

type RelationshipType = (typeof RELATIONSHIP_TYPES)[number]

interface ExtractedRelationship {
  entityA: string
  entityB: string
  type: RelationshipType
  description: string
  confidence: number
}

async function extractRelationships(
  chunkContent: string,
  entityNames: string[],
  apiKey: string
): Promise<ExtractedRelationship[]> {
  if (entityNames.length < 2) return []

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Given this text and the entities mentioned in it, identify relationships between entity pairs.

Entities present: ${entityNames.join(', ')}

Relationship types: ${RELATIONSHIP_TYPES.join(', ')}

Text:
---
${chunkContent}
---

For each relationship found, provide:
- entityA: name of first entity
- entityB: name of second entity
- type: one of the relationship types above
- description: 1 sentence describing the relationship evidence
- confidence: 0.0-1.0

Return JSON array:
[{"entityA":"...","entityB":"...","type":"...","description":"...","confidence":0.8}]

Return [] if no relationships found. Only include relationships clearly supported by the text.`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
        },
      }),
    }
  )

  if (!response.ok) return []

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]'

  try {
    const parsed = JSON.parse(text) as ExtractedRelationship[]
    return parsed.filter((r) => RELATIONSHIP_TYPES.includes(r.type as RelationshipType))
  } catch {
    return []
  }
}

// --- Stage handler ---

export async function handleRelationshipMap(
  documentId: string,
  supabase: SupabaseClient
): Promise<void> {
  console.log(`[RelMap] Processing document ${documentId}`)

  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) throw new Error('GOOGLE_AI_API_KEY not set')

  // Get all chunks with their entity mentions
  const { data: chunks, error } = await supabase
    .from('chunks')
    .select('id, content')
    .eq('document_id', documentId)
    .order('chunk_index', { ascending: true })

  if (error || !chunks) throw new Error(`Failed to fetch chunks: ${error?.message}`)

  let totalRelationships = 0

  for (const chunk of chunks) {
    // Get entities mentioned in this chunk
    const { data: mentions } = await supabase
      .from('entity_mentions')
      .select('entity_id, mention_text, entities(id, name)')
      .eq('chunk_id', chunk.id)

    if (!mentions || mentions.length < 2) continue

    const entityNames = mentions
      .map((m: any) => m.entities?.name)
      .filter(Boolean) as string[]

    const entityMap = new Map<string, string>()
    for (const m of mentions) {
      const entity = (m as any).entities
      if (entity) entityMap.set(entity.name, entity.id)
    }

    try {
      const relationships = await extractRelationships(
        chunk.content,
        entityNames,
        apiKey
      )

      for (const rel of relationships) {
        const entityAId = entityMap.get(rel.entityA)
        const entityBId = entityMap.get(rel.entityB)
        if (!entityAId || !entityBId || entityAId === entityBId) continue

        // Sort IDs to avoid duplicate A-B / B-A entries
        const [id1, id2] = [entityAId, entityBId].sort()

        const { error: insertError } = await supabase
          .from('entity_relationships')
          .upsert(
            {
              entity_a_id: id1,
              entity_b_id: id2,
              relationship_type: rel.type,
              description: rel.description,
              evidence_chunk_ids: [chunk.id],
              evidence_document_ids: [documentId],
              strength: rel.confidence,
            },
            { onConflict: 'entity_a_id,entity_b_id,relationship_type' }
          )

        if (!insertError) totalRelationships++
      }

      await new Promise((r) => setTimeout(r, 300))
    } catch (err) {
      console.warn(`[RelMap] Error on chunk ${chunk.id}:`, err)
    }
  }

  console.log(
    `[RelMap] Document ${documentId}: mapped ${totalRelationships} relationships`
  )
}
```

### Step 14: Build Stage 8 — Redaction detector

File: `worker/src/services/redaction-detector.ts`

```typescript
// worker/src/services/redaction-detector.ts
// Stage 8: Redaction Detection — Detect and catalog redacted regions.
// Finds [REDACTED] markers in OCR text, extracts surrounding context,
// and generates embeddings for similarity matching.

import { SupabaseClient } from '@supabase/supabase-js'

interface DetectedRedaction {
  redactionType: string
  charLengthEstimate: number
  surroundingText: string
  sentenceTemplate: string
  pageNumber: number | null
  positionInPage: { paragraph: number; offset: number } | null
}

/**
 * Detect redactions from OCR text using pattern matching and LLM analysis.
 * The OCR stage marks redacted areas as [REDACTED].
 */
async function detectRedactions(
  ocrText: string,
  chunkContent: string,
  chunkPageNumber: number | null,
  apiKey: string
): Promise<DetectedRedaction[]> {
  // Quick check: does the chunk contain redaction markers?
  if (!chunkContent.includes('[REDACTED]') && !chunkContent.includes('[REDACT')) {
    return []
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Analyze this text for redacted content (marked as [REDACTED]).

For each redaction found, determine:
- redactionType: "person_name", "organization", "location", "date", "phone_number", "address", "account_number", "other"
- charLengthEstimate: estimated number of characters that were redacted (based on context)
- surroundingText: the sentence containing the redaction with 1 sentence before and after
- sentenceTemplate: the sentence with [REDACTED] left in place

Text:
---
${chunkContent}
---

Return JSON:
{
  "redactions": [
    {
      "redactionType": "person_name",
      "charLengthEstimate": 15,
      "surroundingText": "The witness testified that [REDACTED] was present at the meeting on March 3rd.",
      "sentenceTemplate": "The witness testified that [REDACTED] was present at the meeting on March 3rd."
    }
  ]
}

Return { "redactions": [] } if no redactions found.`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
        },
      }),
    }
  )

  if (!response.ok) return []

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{"redactions":[]}'

  try {
    const parsed = JSON.parse(text)
    return (parsed.redactions || []).map((r: any) => ({
      ...r,
      pageNumber: chunkPageNumber,
      positionInPage: null,
    }))
  } catch {
    return []
  }
}

// --- Stage handler ---

export async function handleRedactionDetect(
  documentId: string,
  supabase: SupabaseClient
): Promise<void> {
  console.log(`[RedactionDetect] Processing document ${documentId}`)

  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) throw new Error('GOOGLE_AI_API_KEY not set')

  const { data: doc } = await supabase
    .from('documents')
    .select('ocr_text')
    .eq('id', documentId)
    .single()

  const { data: chunks, error } = await supabase
    .from('chunks')
    .select('id, content, page_number')
    .eq('document_id', documentId)
    .order('chunk_index', { ascending: true })

  if (error || !chunks) throw new Error(`Failed to fetch chunks: ${error?.message}`)

  // Delete existing redactions for idempotency
  await supabase.from('redactions').delete().eq('document_id', documentId)

  let totalRedactions = 0

  for (const chunk of chunks) {
    try {
      const redactions = await detectRedactions(
        doc?.ocr_text || '',
        chunk.content,
        chunk.page_number,
        apiKey
      )

      for (const redaction of redactions) {
        // Generate context embedding for similarity matching
        let contextEmbedding: number[] | null = null
        try {
          const embResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: 'models/text-embedding-004',
                content: { parts: [{ text: redaction.surroundingText }] },
              }),
            }
          )
          if (embResponse.ok) {
            const embData = await embResponse.json()
            contextEmbedding = embData.embedding.values
          }
        } catch {
          // Embedding is optional — continue without it
        }

        const { error: insertError } = await supabase.from('redactions').insert({
          document_id: documentId,
          chunk_id: chunk.id,
          page_number: redaction.pageNumber,
          redaction_type: redaction.redactionType,
          char_length_estimate: redaction.charLengthEstimate,
          surrounding_text: redaction.surroundingText,
          sentence_template: redaction.sentenceTemplate,
          context_embedding: contextEmbedding
            ? JSON.stringify(contextEmbedding)
            : null,
          status: 'unsolved',
        })

        if (!insertError) totalRedactions++
      }

      if (redactions.length > 0) {
        await new Promise((r) => setTimeout(r, 300))
      }
    } catch (err) {
      console.warn(`[RedactionDetect] Error on chunk ${chunk.id}:`, err)
    }
  }

  // Update document redaction flags
  await supabase
    .from('documents')
    .update({
      is_redacted: totalRedactions > 0,
      redaction_count: totalRedactions,
    })
    .eq('id', documentId)

  console.log(
    `[RedactionDetect] Document ${documentId}: detected ${totalRedactions} redactions`
  )
}
```

### Step 15: Build Stage 9 — Timeline extractor

File: `worker/src/services/timeline-extractor.ts`

```typescript
// worker/src/services/timeline-extractor.ts
// Stage 9: Timeline Extraction — Extract dated events from document chunks.
// Creates timeline_events records linked to entities and source documents.

import { SupabaseClient } from '@supabase/supabase-js'

interface ExtractedEvent {
  date: string | null
  datePrecision: 'exact' | 'month' | 'year' | 'approximate'
  dateDisplay: string
  description: string
  eventType: string
  location: string | null
  entityNames: string[]
}

async function extractTimelineEvents(
  chunkContent: string,
  documentType: string,
  apiKey: string
): Promise<ExtractedEvent[]> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Extract all dated events from this ${documentType} document text.

Text:
---
${chunkContent}
---

For each event with a date (explicit or implied), provide:
- date: ISO 8601 format if possible (e.g., "2003-07-15"), null if no specific date
- datePrecision: "exact", "month", "year", or "approximate"
- dateDisplay: Human-readable date (e.g., "July 15, 2003" or "Summer 2003")
- description: 1-2 sentence description of the event
- eventType: "travel", "meeting", "legal", "communication", "financial", "testimony", "arrest", "other"
- location: Location if mentioned, null otherwise
- entityNames: Names of entities involved

Return JSON: { "events": [...] }
Return { "events": [] } if no dated events found.`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
        },
      }),
    }
  )

  if (!response.ok) return []

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{"events":[]}'

  try {
    return JSON.parse(text).events || []
  } catch {
    return []
  }
}

// --- Stage handler ---

export async function handleTimelineExtract(
  documentId: string,
  supabase: SupabaseClient
): Promise<void> {
  console.log(`[Timeline] Processing document ${documentId}`)

  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) throw new Error('GOOGLE_AI_API_KEY not set')

  const { data: doc } = await supabase
    .from('documents')
    .select('classification')
    .eq('id', documentId)
    .single()

  const { data: chunks, error } = await supabase
    .from('chunks')
    .select('id, content')
    .eq('document_id', documentId)
    .order('chunk_index', { ascending: true })

  if (error || !chunks) throw new Error(`Failed to fetch chunks: ${error?.message}`)

  let totalEvents = 0

  for (const chunk of chunks) {
    try {
      const events = await extractTimelineEvents(
        chunk.content,
        doc?.classification || 'unknown',
        apiKey
      )

      for (const event of events) {
        // Resolve entity names to IDs
        const entityIds: string[] = []
        for (const name of event.entityNames || []) {
          const { data: entity } = await supabase
            .from('entities')
            .select('id')
            .eq('name', name)
            .single()
          if (entity) entityIds.push(entity.id)
        }

        const { error: insertError } = await supabase.from('timeline_events').insert({
          event_date: event.date,
          date_precision: event.datePrecision,
          date_display: event.dateDisplay,
          description: event.description,
          event_type: event.eventType,
          location: event.location,
          source_chunk_ids: [chunk.id],
          source_document_ids: [documentId],
          entity_ids: entityIds,
        })

        if (!insertError) totalEvents++
      }

      if (events.length > 0) {
        await new Promise((r) => setTimeout(r, 200))
      }
    } catch (err) {
      console.warn(`[Timeline] Error on chunk ${chunk.id}:`, err)
    }
  }

  console.log(`[Timeline] Document ${documentId}: extracted ${totalEvents} events`)
}
```

### Step 16: Build Stage 10 — Document summarizer

File: `worker/src/services/document-summarizer.ts`

```typescript
// worker/src/services/document-summarizer.ts
// Stage 10: Document Summary — Generate executive summary per document.
// Runs after entity extraction for maximum context.

import { SupabaseClient } from '@supabase/supabase-js'

interface DocumentSummary {
  summary: string
  keyPeople: string[]
  timePeriod: string | null
  significance: string
  potentialCriminalIndicators: string[]
}

async function generateSummary(
  ocrText: string,
  classification: string,
  entityNames: string[],
  apiKey: string
): Promise<DocumentSummary> {
  // Use first 8000 + last 2000 chars for summary
  const textSample =
    ocrText.length > 10000
      ? ocrText.slice(0, 8000) + '\n...\n' + ocrText.slice(-2000)
      : ocrText

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Generate an executive summary of this ${classification} document.

Known entities in this document: ${entityNames.slice(0, 20).join(', ')}

Document text:
---
${textSample}
---

Provide JSON:
{
  "summary": "<3-5 sentence executive summary of what this document is and its key content>",
  "keyPeople": ["<names of most important people mentioned>"],
  "timePeriod": "<date range covered, e.g. 'March-July 2003' or null>",
  "significance": "<1 sentence on why this document matters for the investigation>",
  "potentialCriminalIndicators": ["<brief descriptions of any content suggesting trafficking, obstruction, conspiracy, or financial crimes>"]
}

Be factual. For potentialCriminalIndicators, flag patterns — never make accusations.`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1024,
          responseMimeType: 'application/json',
        },
      }),
    }
  )

  if (!response.ok) {
    throw new Error(`Summary API failed: ${response.status}`)
  }

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'

  try {
    return JSON.parse(text) as DocumentSummary
  } catch {
    return {
      summary: 'Summary generation failed.',
      keyPeople: [],
      timePeriod: null,
      significance: '',
      potentialCriminalIndicators: [],
    }
  }
}

// --- Stage handler ---

export async function handleSummarize(
  documentId: string,
  supabase: SupabaseClient
): Promise<void> {
  console.log(`[Summarize] Processing document ${documentId}`)

  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) throw new Error('GOOGLE_AI_API_KEY not set')

  const { data: doc, error } = await supabase
    .from('documents')
    .select('id, ocr_text, classification, metadata')
    .eq('id', documentId)
    .single()

  if (error || !doc) throw new Error(`Document not found: ${documentId}`)
  if (!doc.ocr_text) throw new Error(`Document ${documentId} has no OCR text`)

  // Get entity names mentioned in this document
  const { data: mentions } = await supabase
    .from('entity_mentions')
    .select('entities(name)')
    .eq('document_id', documentId)

  const entityNames = [
    ...new Set((mentions || []).map((m: any) => m.entities?.name).filter(Boolean)),
  ] as string[]

  const summary = await generateSummary(
    doc.ocr_text,
    doc.classification || 'unknown',
    entityNames,
    apiKey
  )

  // Merge summary into existing metadata
  const existingMetadata = (doc.metadata as Record<string, unknown>) || {}
  const { error: updateError } = await supabase
    .from('documents')
    .update({
      metadata: {
        ...existingMetadata,
        summary: summary.summary,
        key_people: summary.keyPeople,
        time_period: summary.timePeriod,
        significance: summary.significance,
        criminal_indicators: summary.potentialCriminalIndicators,
        summary_timestamp: new Date().toISOString(),
      },
    })
    .eq('id', documentId)

  if (updateError) {
    throw new Error(`Failed to update document summary: ${updateError.message}`)
  }

  console.log(`[Summarize] Document ${documentId}: summary generated (${summary.summary.length} chars)`)
}
```

### Step 17: Build Stage 11 — Criminal indicator scorer

File: `worker/src/services/criminal-indicator-scorer.ts`

```typescript
// worker/src/services/criminal-indicator-scorer.ts
// Stage 11: Criminal Indicator Scoring — Flag evidence of crimes.
// CRITICAL ETHICAL NOTE: Flags patterns for human review — never makes accusations.

import { SupabaseClient } from '@supabase/supabase-js'

const INDICATOR_CATEGORIES = [
  'trafficking',
  'obstruction',
  'conspiracy',
  'financial_crimes',
  'witness_tampering',
  'exploitation',
] as const

type IndicatorCategory = (typeof INDICATOR_CATEGORIES)[number]

interface CriminalIndicator {
  category: IndicatorCategory
  severity: 'low' | 'medium' | 'high'
  description: string
  evidenceSnippet: string
  confidence: number
}

async function analyzeCriminalIndicators(
  ocrTextSample: string,
  classification: string,
  entities: string[],
  apiKey: string
): Promise<CriminalIndicator[]> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Analyze this ${classification} document for patterns that may indicate criminal activity.

Categories to check:
- trafficking: travel patterns with minors, exploitation language, grooming indicators
- obstruction: document destruction references, witness intimidation, evidence concealment
- conspiracy: coordination language, coded communication, planning references
- financial_crimes: money laundering patterns, hidden assets, unreported transfers
- witness_tampering: threats to witnesses, incentives for silence, intimidation
- exploitation: power dynamics, coercion references, abuse indicators

Known entities in document: ${entities.slice(0, 10).join(', ')}

Document text:
---
${ocrTextSample}
---

For each indicator found, provide:
- category: one of the categories above
- severity: "low", "medium", or "high"
- description: what pattern was detected and why it's notable
- evidenceSnippet: the relevant text excerpt (max 200 chars)
- confidence: 0.0-1.0

IMPORTANT: Flag patterns for human review only. Do NOT make accusations.

Return JSON: { "indicators": [...] }
Return { "indicators": [] } if no indicators found.`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
        },
      }),
    }
  )

  if (!response.ok) return []

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{"indicators":[]}'

  try {
    return JSON.parse(text).indicators || []
  } catch {
    return []
  }
}

// --- Stage handler ---

export async function handleCriminalIndicators(
  documentId: string,
  supabase: SupabaseClient
): Promise<void> {
  console.log(`[CriminalIndicators] Processing document ${documentId}`)

  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) throw new Error('GOOGLE_AI_API_KEY not set')

  const { data: doc, error } = await supabase
    .from('documents')
    .select('id, ocr_text, classification, metadata')
    .eq('id', documentId)
    .single()

  if (error || !doc) throw new Error(`Document not found: ${documentId}`)
  if (!doc.ocr_text) return

  const { data: mentions } = await supabase
    .from('entity_mentions')
    .select('entities(name)')
    .eq('document_id', documentId)

  const entityNames = [
    ...new Set((mentions || []).map((m: any) => m.entities?.name).filter(Boolean)),
  ] as string[]

  const textSample =
    doc.ocr_text.length > 10000
      ? doc.ocr_text.slice(0, 8000) + '\n...\n' + doc.ocr_text.slice(-2000)
      : doc.ocr_text

  const indicators = await analyzeCriminalIndicators(
    textSample,
    doc.classification || 'unknown',
    entityNames,
    apiKey
  )

  // Store indicators in document metadata
  const existingMetadata = (doc.metadata as Record<string, unknown>) || {}
  await supabase
    .from('documents')
    .update({
      metadata: {
        ...existingMetadata,
        criminal_indicators: indicators,
        criminal_indicator_count: indicators.length,
        criminal_indicator_timestamp: new Date().toISOString(),
      },
    })
    .eq('id', documentId)

  console.log(
    `[CriminalIndicators] Document ${documentId}: found ${indicators.length} indicators`
  )
}
```

### Step 18: Build the cascade engine

File: `worker/src/services/cascade-engine.ts`

```typescript
// worker/src/services/cascade-engine.ts
// When a redaction is solved, find similar unsolved redactions and auto-propose.
// Matching criteria: context similarity > 0.80, char length +/-3, same redaction type.

import { SupabaseClient } from '@supabase/supabase-js'

interface CascadeResult {
  cascadeCount: number
  proposalsCreated: number
  matchedRedactionIds: string[]
}

export async function runCascade(
  solvedRedactionId: string,
  supabase: SupabaseClient
): Promise<CascadeResult> {
  console.log(`[Cascade] Running cascade for redaction ${solvedRedactionId}`)

  // 1. Fetch the solved redaction
  const { data: solved, error } = await supabase
    .from('redactions')
    .select('*')
    .eq('id', solvedRedactionId)
    .eq('status', 'solved')
    .single()

  if (error || !solved) {
    throw new Error(`Solved redaction not found: ${solvedRedactionId}`)
  }

  if (!solved.context_embedding) {
    console.warn('[Cascade] Solved redaction has no context embedding, skipping')
    return { cascadeCount: 0, proposalsCreated: 0, matchedRedactionIds: [] }
  }

  // 2. Find similar unsolved redactions using vector similarity
  // Try the RPC first, fall back to manual query
  let matchedRedactions: any[] = []

  try {
    const { data: matches } = await supabase.rpc('find_similar_redactions', {
      query_embedding: solved.context_embedding,
      similarity_threshold: 0.80,
      match_count: 50,
      redaction_type_filter: solved.redaction_type,
      char_length_min: (solved.char_length_estimate || 10) - 3,
      char_length_max: (solved.char_length_estimate || 10) + 3,
    })

    matchedRedactions = matches || []
  } catch {
    console.warn('[Cascade] find_similar_redactions RPC not available')
    return { cascadeCount: 0, proposalsCreated: 0, matchedRedactionIds: [] }
  }

  // 3. Filter out already-solved and self-references
  const unsolved = matchedRedactions.filter(
    (r: any) => r.id !== solvedRedactionId && r.status === 'unsolved'
  )

  // 4. Create proposals for high-confidence cascades
  let proposalsCreated = 0
  const matchedIds: string[] = []

  for (const match of unsolved) {
    matchedIds.push(match.id)

    const { error: propError } = await supabase.from('redaction_proposals').insert({
      redaction_id: match.id,
      user_id: solved.resolved_entity_id ? solved.resolved_entity_id : null, // System user
      proposed_text: solved.resolved_text,
      proposed_entity_id: solved.resolved_entity_id,
      evidence_type: 'cascade',
      evidence_description: `Auto-cascaded from solved redaction in document. Context similarity: ${match.similarity?.toFixed(2) || 'N/A'}`,
      evidence_sources: [solvedRedactionId],
      context_match_score: match.similarity,
      length_match: true,
      status: 'pending',
    })

    if (!propError) proposalsCreated++

    // Update cascade metadata on the matched redaction
    await supabase
      .from('redactions')
      .update({
        cascade_source_id: solvedRedactionId,
        cascade_depth: (solved.cascade_depth || 0) + 1,
      })
      .eq('id', match.id)
  }

  // 5. Update cascade count on the solved redaction
  await supabase
    .from('redactions')
    .update({ cascade_count: unsolved.length })
    .eq('id', solvedRedactionId)

  console.log(
    `[Cascade] Redaction ${solvedRedactionId}: cascaded to ${unsolved.length} matches, created ${proposalsCreated} proposals`
  )

  return {
    cascadeCount: unsolved.length,
    proposalsCreated,
    matchedRedactionIds: matchedIds,
  }
}
```

### Step 19: Build the audio processor

File: `worker/src/services/audio-processor.ts`

```typescript
// worker/src/services/audio-processor.ts
// Process audio files: transcribe, chunk, embed, extract entities.
// Uses Whisper (via OpenAI API) for transcription.

import { SupabaseClient } from '@supabase/supabase-js'

interface TranscriptSegment {
  start: number
  end: number
  text: string
  speaker?: string
}

async function transcribeAudio(
  audioBuffer: Buffer,
  filename: string,
  apiKey: string
): Promise<{ transcript: string; segments: TranscriptSegment[] }> {
  // Use OpenAI Whisper API
  const formData = new FormData()
  const blob = new Blob([audioBuffer])
  formData.append('file', blob, filename)
  formData.append('model', 'whisper-1')
  formData.append('response_format', 'verbose_json')
  formData.append('timestamp_granularities[]', 'segment')

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  })

  if (!response.ok) {
    throw new Error(`Whisper API failed: ${response.status}`)
  }

  const data = await response.json()
  const segments: TranscriptSegment[] = (data.segments || []).map((s: any) => ({
    start: s.start,
    end: s.end,
    text: s.text,
  }))

  return { transcript: data.text, segments }
}

// --- Handler ---

export async function handleAudioProcess(
  audioFileId: string,
  supabase: SupabaseClient
): Promise<void> {
  console.log(`[Audio] Processing audio file ${audioFileId}`)

  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) throw new Error('OPENAI_API_KEY not set for audio transcription')

  // Fetch audio file record (assumes an audio_files table or using documents)
  const { data: audioFile, error } = await supabase
    .from('documents')
    .select('id, filename, storage_path, mime_type')
    .eq('id', audioFileId)
    .single()

  if (error || !audioFile) throw new Error(`Audio file not found: ${audioFileId}`)

  // Download audio
  const { data: fileData, error: dlError } = await supabase.storage
    .from('documents')
    .download(audioFile.storage_path)

  if (dlError || !fileData) throw new Error(`Failed to download: ${dlError?.message}`)

  const audioBuffer = Buffer.from(await fileData.arrayBuffer())

  // Transcribe
  const { transcript, segments } = await transcribeAudio(
    audioBuffer,
    audioFile.filename,
    openaiKey
  )

  // Update document with transcript
  await supabase
    .from('documents')
    .update({
      ocr_text: transcript,
      metadata: {
        audio_segments: segments.length,
        audio_duration: segments.length > 0 ? segments[segments.length - 1].end : 0,
        transcription_timestamp: new Date().toISOString(),
      },
    })
    .eq('id', audioFileId)

  console.log(
    `[Audio] File ${audioFileId}: transcribed ${transcript.length} chars, ${segments.length} segments`
  )
}
```

### Step 20: Build the structured data extractor

File: `worker/src/services/structured-extractor.ts`

```typescript
// worker/src/services/structured-extractor.ts
// Extract structured records from semi-structured documents.
// Handles: flight manifests, financial records, phone records, address books.

import { SupabaseClient } from '@supabase/supabase-js'

type ExtractionType = 'flight_manifest' | 'financial_record' | 'phone_record' | 'address_book'

interface FlightRecord {
  date: string | null
  aircraft: string | null
  origin: string | null
  destination: string | null
  passengers: string[]
  pilot: string | null
}

interface FinancialRecord {
  date: string | null
  amount: number | null
  currency: string
  fromAccount: string | null
  toAccount: string | null
  parties: string[]
  description: string | null
}

interface PhoneRecord {
  date: string | null
  fromNumber: string | null
  toNumber: string | null
  duration: string | null
  parties: string[]
}

interface AddressBookEntry {
  name: string
  addresses: string[]
  phoneNumbers: string[]
  relationships: string[]
}

type StructuredRecord = FlightRecord | FinancialRecord | PhoneRecord | AddressBookEntry

async function extractStructuredData(
  ocrText: string,
  documentType: string,
  apiKey: string
): Promise<{ type: ExtractionType; records: StructuredRecord[] }> {
  const typeMap: Record<string, ExtractionType> = {
    flight_log: 'flight_manifest',
    financial_record: 'financial_record',
    phone_record: 'phone_record',
    address_book: 'address_book',
  }

  const extractionType = typeMap[documentType]
  if (!extractionType) {
    return { type: 'flight_manifest', records: [] }
  }

  const textSample =
    ocrText.length > 15000
      ? ocrText.slice(0, 10000) + '\n...\n' + ocrText.slice(-5000)
      : ocrText

  const schemaByType: Record<ExtractionType, string> = {
    flight_manifest: `[{"date":"2003-07-15","aircraft":"N908JE","origin":"Teterboro","destination":"Palm Beach","passengers":["Name1","Name2"],"pilot":"Larry Visoski"}]`,
    financial_record: `[{"date":"2003-07-15","amount":50000,"currency":"USD","fromAccount":"...","toAccount":"...","parties":["Name"],"description":"Wire transfer"}]`,
    phone_record: `[{"date":"2003-07-15","fromNumber":"555-0100","toNumber":"555-0200","duration":"5:32","parties":["Name1","Name2"]}]`,
    address_book: `[{"name":"John Doe","addresses":["123 Main St"],"phoneNumbers":["555-0100"],"relationships":["associate"]}]`,
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Extract structured ${extractionType.replace('_', ' ')} records from this document.

Expected format (array of records):
${schemaByType[extractionType]}

Document text:
---
${textSample}
---

Return JSON: { "records": [...] }
Extract ALL records you can find. Use null for missing fields.`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
        },
      }),
    }
  )

  if (!response.ok) return { type: extractionType, records: [] }

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{"records":[]}'

  try {
    return { type: extractionType, records: JSON.parse(text).records || [] }
  } catch {
    return { type: extractionType, records: [] }
  }
}

// --- Handler ---

export async function handleStructuredExtraction(
  documentId: string,
  supabase: SupabaseClient
): Promise<void> {
  console.log(`[StructuredExtract] Processing document ${documentId}`)

  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) throw new Error('GOOGLE_AI_API_KEY not set')

  const { data: doc, error } = await supabase
    .from('documents')
    .select('id, ocr_text, classification')
    .eq('id', documentId)
    .single()

  if (error || !doc || !doc.ocr_text) return

  const structuredTypes = ['flight_log', 'financial_record', 'phone_record', 'address_book']
  if (!structuredTypes.includes(doc.classification || '')) return

  const { type, records } = await extractStructuredData(
    doc.ocr_text,
    doc.classification || '',
    apiKey
  )

  if (records.length === 0) return

  // Store in document metadata
  const { data: existing } = await supabase
    .from('documents')
    .select('metadata')
    .eq('id', documentId)
    .single()

  await supabase
    .from('documents')
    .update({
      metadata: {
        ...((existing?.metadata as Record<string, unknown>) || {}),
        structured_data_type: type,
        structured_records: records,
        structured_extraction_timestamp: new Date().toISOString(),
      },
    })
    .eq('id', documentId)

  console.log(
    `[StructuredExtract] Document ${documentId}: extracted ${records.length} ${type} records`
  )
}
```

### Step 21: Build the video transcriber

File: `worker/src/services/video-transcriber.ts`

```typescript
// worker/src/services/video-transcriber.ts
// Transcribe video files and create video_chunks records.
// Uses Whisper via OpenAI API for transcription.

import { SupabaseClient } from '@supabase/supabase-js'

export async function handleVideoTranscribe(
  videoId: string,
  supabase: SupabaseClient
): Promise<void> {
  console.log(`[Video] Processing video ${videoId}`)

  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) throw new Error('OPENAI_API_KEY not set')

  // Fetch video record
  const { data: video, error } = await supabase
    .from('videos')
    .select('id, filename, storage_path')
    .eq('id', videoId)
    .single()

  if (error || !video) throw new Error(`Video not found: ${videoId}`)

  // Download video
  const { data: fileData, error: dlError } = await supabase.storage
    .from('videos')
    .download(video.storage_path)

  if (dlError || !fileData) throw new Error(`Failed to download: ${dlError?.message}`)

  const videoBuffer = Buffer.from(await fileData.arrayBuffer())

  // Transcribe using Whisper
  const formData = new FormData()
  const blob = new Blob([videoBuffer])
  formData.append('file', blob, video.filename)
  formData.append('model', 'whisper-1')
  formData.append('response_format', 'verbose_json')
  formData.append('timestamp_granularities[]', 'segment')

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${openaiKey}` },
    body: formData,
  })

  if (!response.ok) throw new Error(`Whisper API failed: ${response.status}`)

  const data = await response.json()
  const segments = data.segments || []

  // Update video record
  await supabase
    .from('videos')
    .update({
      transcript: data.text,
      processing_status: 'complete',
      duration_seconds: segments.length > 0 ? Math.ceil(segments[segments.length - 1].end) : 0,
    })
    .eq('id', videoId)

  // Create video_chunks from segments (group into ~1000 char chunks)
  await supabase.from('video_chunks').delete().eq('video_id', videoId)

  let chunkIndex = 0
  let currentChunk = ''
  let chunkStart = 0

  for (const segment of segments) {
    if (currentChunk.length + segment.text.length > 1000 && currentChunk.length > 0) {
      await supabase.from('video_chunks').insert({
        video_id: videoId,
        chunk_index: chunkIndex++,
        content: currentChunk.trim(),
        timestamp_start: chunkStart,
        timestamp_end: segment.start,
      })
      currentChunk = ''
      chunkStart = segment.start
    }
    currentChunk += ' ' + segment.text
  }

  // Final chunk
  if (currentChunk.trim().length > 0) {
    await supabase.from('video_chunks').insert({
      video_id: videoId,
      chunk_index: chunkIndex,
      content: currentChunk.trim(),
      timestamp_start: chunkStart,
      timestamp_end: segments.length > 0 ? segments[segments.length - 1].end : 0,
    })
  }

  console.log(`[Video] Video ${videoId}: transcribed, created ${chunkIndex + 1} chunks`)
}
```

### Step 22: Build the chat orchestrator and API

File: `worker/src/chatbot/chat-orchestrator.ts`

```typescript
// worker/src/chatbot/chat-orchestrator.ts
// Agentic tool-calling loop for the research assistant chatbot.
// Receives user message + history, calls tools iteratively, returns response with citations.

import { SupabaseClient } from '@supabase/supabase-js'
import { searchDocumentsTool } from './tools/search-documents.js'
import { lookupEntityTool } from './tools/lookup-entity.js'
import { mapConnectionsTool } from './tools/map-connections.js'
import { buildTimelineTool } from './tools/build-timeline.js'

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  toolCallId?: string
  toolName?: string
}

export interface ChatTool {
  name: string
  description: string
  parameters: Record<string, unknown>
  execute: (params: Record<string, unknown>, supabase: SupabaseClient) => Promise<string>
}

export interface ChatResponse {
  content: string
  citations: Array<{ documentId: string; chunkId: string; text: string }>
  toolsUsed: string[]
}

const SYSTEM_PROMPT = `You are a research assistant for the Epstein Files Archive — a database of 3.5 million pages of documents released by the U.S. Department of Justice. Your role is to help researchers, journalists, and the public navigate this evidence.

Guidelines:
- Always cite your sources with document IDs and page numbers
- Be factual — state what the documents show, not conclusions
- Flag potential connections but note they need verification
- For sensitive content, maintain professional research tone
- If asked about criminal activity, present evidence patterns without making accusations
- Distinguish between verified facts and speculation

You have access to tools for searching documents, looking up entities, mapping connections, and building timelines. Use them to answer questions thoroughly.`

export class ChatOrchestrator {
  private tools: Map<string, ChatTool> = new Map()
  private supabase: SupabaseClient
  private apiKey: string
  private maxIterations: number

  constructor(supabase: SupabaseClient, apiKey: string, maxIterations = 5) {
    this.supabase = supabase
    this.apiKey = apiKey
    this.maxIterations = maxIterations

    // Register tools
    this.registerTool(searchDocumentsTool)
    this.registerTool(lookupEntityTool)
    this.registerTool(mapConnectionsTool)
    this.registerTool(buildTimelineTool)
  }

  registerTool(tool: ChatTool): void {
    this.tools.set(tool.name, tool)
  }

  async chat(messages: ChatMessage[]): Promise<ChatResponse> {
    const toolsUsed: string[] = []
    const allCitations: ChatResponse['citations'] = []

    // Build conversation with system prompt
    const conversation: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages,
    ]

    // Tool-calling loop
    for (let iteration = 0; iteration < this.maxIterations; iteration++) {
      const response = await this.callLLM(conversation)

      // Check if the response includes tool calls
      if (response.toolCalls && response.toolCalls.length > 0) {
        // Execute each tool call
        for (const toolCall of response.toolCalls) {
          const tool = this.tools.get(toolCall.name)
          if (!tool) {
            conversation.push({
              role: 'tool',
              content: `Error: Unknown tool "${toolCall.name}"`,
              toolCallId: toolCall.id,
              toolName: toolCall.name,
            })
            continue
          }

          try {
            const result = await tool.execute(toolCall.arguments, this.supabase)
            conversation.push({
              role: 'tool',
              content: result,
              toolCallId: toolCall.id,
              toolName: toolCall.name,
            })
            toolsUsed.push(toolCall.name)
          } catch (err) {
            conversation.push({
              role: 'tool',
              content: `Error executing ${toolCall.name}: ${err instanceof Error ? err.message : String(err)}`,
              toolCallId: toolCall.id,
              toolName: toolCall.name,
            })
          }
        }

        // Continue loop — LLM will process tool results
        continue
      }

      // No tool calls — return final response
      return {
        content: response.content,
        citations: allCitations,
        toolsUsed: [...new Set(toolsUsed)],
      }
    }

    // Max iterations reached
    return {
      content: 'I reached the maximum number of tool calls. Here is what I found so far based on the research conducted.',
      citations: allCitations,
      toolsUsed: [...new Set(toolsUsed)],
    }
  }

  private async callLLM(
    messages: ChatMessage[]
  ): Promise<{
    content: string
    toolCalls?: Array<{ id: string; name: string; arguments: Record<string, unknown> }>
  }> {
    // Build tool definitions for the API
    const toolDefs = Array.from(this.tools.values()).map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }))

    const geminiMessages = messages.map((m) => ({
      role: m.role === 'system' ? 'user' : m.role === 'tool' ? 'user' : m.role,
      parts: [{ text: m.role === 'system' ? `[SYSTEM] ${m.content}` : m.content }],
    }))

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${process.env.CHAT_MODEL || 'gemini-2.0-flash'}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: geminiMessages,
          tools: [{ functionDeclarations: toolDefs.map((t) => t.function) }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 4096,
          },
        }),
      }
    )

    if (!response.ok) {
      throw new Error(`Chat LLM API failed: ${response.status}`)
    }

    const data = await response.json()
    const candidate = data.candidates?.[0]
    const parts = candidate?.content?.parts || []

    // Check for function calls
    const functionCalls = parts.filter((p: any) => p.functionCall)
    if (functionCalls.length > 0) {
      return {
        content: '',
        toolCalls: functionCalls.map((p: any, i: number) => ({
          id: `call_${i}`,
          name: p.functionCall.name,
          arguments: p.functionCall.args || {},
        })),
      }
    }

    // Text response
    const textContent = parts
      .filter((p: any) => p.text)
      .map((p: any) => p.text)
      .join('')

    return { content: textContent }
  }
}
```

File: `worker/src/chatbot/tools/search-documents.ts`

```typescript
// worker/src/chatbot/tools/search-documents.ts
import { SupabaseClient } from '@supabase/supabase-js'
import type { ChatTool } from '../chat-orchestrator.js'

export const searchDocumentsTool: ChatTool = {
  name: 'search_documents',
  description:
    'Search the Epstein Files corpus using semantic and keyword search. Returns relevant document chunks with citations.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
      limit: { type: 'number', description: 'Max results (default 10)' },
      documentType: { type: 'string', description: 'Filter by document type' },
    },
    required: ['query'],
  },
  execute: async (params, supabase) => {
    const query = String(params.query)
    const limit = Number(params.limit) || 10

    // Generate embedding for semantic search
    const apiKey = process.env.GOOGLE_AI_API_KEY
    if (!apiKey) return 'Search unavailable: API key not configured'

    const embResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'models/text-embedding-004',
          content: { parts: [{ text: query }] },
        }),
      }
    )

    if (!embResponse.ok) return 'Search failed: embedding generation error'

    const embData = await embResponse.json()
    const queryEmbedding = embData.embedding.values

    // Call hybrid search RPC
    const { data: results, error } = await supabase.rpc('hybrid_search_chunks_rrf', {
      query_text: query,
      query_embedding: queryEmbedding,
      match_count: limit,
    })

    if (error || !results) return `Search error: ${error?.message || 'no results'}`

    // Format results as text for the LLM
    return results
      .map(
        (r: any, i: number) =>
          `[${i + 1}] Document: ${r.document_filename} (${r.document_classification || 'unclassified'})
Page: ${r.page_number || 'N/A'} | Dataset: ${r.dataset_name || 'N/A'}
---
${r.content.slice(0, 500)}
---
(doc_id: ${r.document_id}, chunk_id: ${r.chunk_id})`
      )
      .join('\n\n')
  },
}
```

File: `worker/src/chatbot/tools/lookup-entity.ts`

```typescript
// worker/src/chatbot/tools/lookup-entity.ts
import { SupabaseClient } from '@supabase/supabase-js'
import type { ChatTool } from '../chat-orchestrator.js'

export const lookupEntityTool: ChatTool = {
  name: 'lookup_entity',
  description: 'Look up an entity (person, organization, location) and get all their mentions and relationships.',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Entity name to look up' },
    },
    required: ['name'],
  },
  execute: async (params, supabase) => {
    const name = String(params.name)

    const { data: entities } = await supabase
      .from('entities')
      .select('*')
      .ilike('name', `%${name}%`)
      .limit(5)

    if (!entities || entities.length === 0) return `No entity found matching "${name}"`

    const entity = entities[0]
    const { data: mentions } = await supabase
      .from('entity_mentions')
      .select('mention_text, context_snippet, documents(filename)')
      .eq('entity_id', entity.id)
      .limit(10)

    const { data: relationships } = await supabase
      .from('entity_relationships')
      .select('relationship_type, description, entity_b:entities!entity_b_id(name)')
      .eq('entity_a_id', entity.id)
      .limit(10)

    return `Entity: ${entity.name} (${entity.entity_type})
Aliases: ${entity.aliases?.join(', ') || 'none'}
Mentions: ${entity.mention_count} across ${entity.document_count} documents
${entity.description || ''}

Key mentions:
${(mentions || []).map((m: any) => `- "${m.mention_text}" in ${m.documents?.filename || 'unknown'}: ${m.context_snippet || ''}`).join('\n')}

Relationships:
${(relationships || []).map((r: any) => `- ${r.relationship_type} with ${r.entity_b?.name || 'unknown'}: ${r.description || ''}`).join('\n')}`
  },
}
```

File: `worker/src/chatbot/tools/map-connections.ts`

```typescript
// worker/src/chatbot/tools/map-connections.ts
import { SupabaseClient } from '@supabase/supabase-js'
import type { ChatTool } from '../chat-orchestrator.js'

export const mapConnectionsTool: ChatTool = {
  name: 'map_connections',
  description: 'Map connections between two entities, showing how they are related through the document corpus.',
  parameters: {
    type: 'object',
    properties: {
      entityA: { type: 'string', description: 'First entity name' },
      entityB: { type: 'string', description: 'Second entity name' },
    },
    required: ['entityA', 'entityB'],
  },
  execute: async (params, supabase) => {
    const nameA = String(params.entityA)
    const nameB = String(params.entityB)

    const { data: entA } = await supabase.from('entities').select('id, name').ilike('name', `%${nameA}%`).single()
    const { data: entB } = await supabase.from('entities').select('id, name').ilike('name', `%${nameB}%`).single()

    if (!entA || !entB) return `Could not find one or both entities: "${nameA}", "${nameB}"`

    // Direct relationships
    const { data: direct } = await supabase
      .from('entity_relationships')
      .select('*')
      .or(`and(entity_a_id.eq.${entA.id},entity_b_id.eq.${entB.id}),and(entity_a_id.eq.${entB.id},entity_b_id.eq.${entA.id})`)

    // Co-occurrences (chunks where both appear)
    const { data: mentionsA } = await supabase.from('entity_mentions').select('chunk_id').eq('entity_id', entA.id)
    const { data: mentionsB } = await supabase.from('entity_mentions').select('chunk_id').eq('entity_id', entB.id)

    const chunksA = new Set((mentionsA || []).map((m) => m.chunk_id))
    const coOccurrences = (mentionsB || []).filter((m) => chunksA.has(m.chunk_id))

    return `Connection analysis: ${entA.name} <-> ${entB.name}

Direct relationships:
${(direct || []).map((r: any) => `- ${r.relationship_type}: ${r.description || 'no description'}`).join('\n') || 'None found'}

Co-occurrences: Mentioned together in ${coOccurrences.length} text chunks`
  },
}
```

File: `worker/src/chatbot/tools/build-timeline.ts`

```typescript
// worker/src/chatbot/tools/build-timeline.ts
import { SupabaseClient } from '@supabase/supabase-js'
import type { ChatTool } from '../chat-orchestrator.js'

export const buildTimelineTool: ChatTool = {
  name: 'build_timeline',
  description: 'Build a chronological timeline of events for an entity or topic.',
  parameters: {
    type: 'object',
    properties: {
      entityName: { type: 'string', description: 'Entity to build timeline for (optional)' },
      dateFrom: { type: 'string', description: 'Start date (ISO format, optional)' },
      dateTo: { type: 'string', description: 'End date (ISO format, optional)' },
    },
  },
  execute: async (params, supabase) => {
    let query = supabase.from('timeline_events').select('*').order('event_date', { ascending: true }).limit(20)

    if (params.entityName) {
      const { data: entity } = await supabase.from('entities').select('id').ilike('name', `%${params.entityName}%`).single()
      if (entity) {
        query = query.contains('entity_ids', [entity.id])
      }
    }

    if (params.dateFrom) query = query.gte('event_date', String(params.dateFrom))
    if (params.dateTo) query = query.lte('event_date', String(params.dateTo))

    const { data: events, error } = await query

    if (error || !events) return `Timeline error: ${error?.message || 'no events'}`
    if (events.length === 0) return 'No timeline events found for the given criteria.'

    return `Timeline (${events.length} events):
${events.map((e: any) => `- ${e.date_display || e.event_date || 'Unknown date'}: ${e.description} [${e.event_type}]${e.location ? ` at ${e.location}` : ''}`).join('\n')}`
  },
}
```

### Step 23: Build the Chat API route

File: `worker/src/api/chat.ts`

```typescript
// worker/src/api/chat.ts
// Express route handler for POST /chat.
// Accepts messages + session config, returns streaming SSE response.

import { Router, Request, Response } from 'express'
import { SupabaseClient } from '@supabase/supabase-js'
import { ChatOrchestrator, type ChatMessage } from '../chatbot/chat-orchestrator.js'
import { z } from 'zod'

const ChatRequestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string(),
    })
  ),
  sessionId: z.string().optional(),
  tier: z.enum(['free', 'contributor', 'researcher']).default('free'),
})

export function createChatRouter(supabase: SupabaseClient): Router {
  const router = Router()

  router.post('/', async (req: Request, res: Response) => {
    try {
      const parsed = ChatRequestSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid request', details: parsed.error.errors })
        return
      }

      const { messages, sessionId, tier } = parsed.data

      // Rate limiting (simple in-memory — replace with Redis in production)
      // Free: 10 messages/hour, Contributor: 50, Researcher: 200

      const apiKey = process.env.GOOGLE_AI_API_KEY
      if (!apiKey) {
        res.status(503).json({ error: 'Chat service unavailable: no API key' })
        return
      }

      const orchestrator = new ChatOrchestrator(
        supabase,
        apiKey,
        parseInt(process.env.CHAT_MAX_TOOL_ITERATIONS || '5', 10)
      )

      // Set up SSE headers for streaming
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')

      // Send initial event
      res.write(`data: ${JSON.stringify({ type: 'start' })}\n\n`)

      // Process chat
      const response = await orchestrator.chat(messages as ChatMessage[])

      // Send tool usage events
      for (const tool of response.toolsUsed) {
        res.write(`data: ${JSON.stringify({ type: 'tool_used', tool })}\n\n`)
      }

      // Send response content
      // In production, this would stream token by token
      res.write(
        `data: ${JSON.stringify({
          type: 'content',
          content: response.content,
          citations: response.citations,
        })}\n\n`
      )

      // Send done event
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`)

      // Save conversation if session ID provided
      if (sessionId) {
        await supabase.from('chat_conversations').upsert(
          {
            session_id: sessionId,
            messages: [...messages, { role: 'assistant', content: response.content }],
            model_tier: tier,
            message_count: messages.length + 1,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'session_id' }
        )
      }

      res.end()
    } catch (err) {
      console.error('[Chat API] Error:', err)
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Chat processing failed',
          message: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    }
  })

  return router
}
```

### Step 24: Create operational scripts

File: `scripts/download-datasets.sh`

```bash
#!/bin/bash
# scripts/download-datasets.sh
# Download all 12 DOJ Epstein datasets from justice.gov
# Usage: ./scripts/download-datasets.sh [dataset_number]

set -e

BASE_URL="https://www.justice.gov/d9/2025-01"
OUTPUT_DIR="data/raw"

# Dataset URLs (12 DOJ releases)
declare -A DATASETS
DATASETS[1]="epstein-dataset-1.zip"
DATASETS[2]="epstein-dataset-2.zip"
DATASETS[3]="epstein-dataset-3.zip"
DATASETS[4]="epstein-dataset-4.zip"
DATASETS[5]="epstein-dataset-5.zip"
DATASETS[6]="epstein-dataset-6.zip"
DATASETS[7]="epstein-dataset-7.zip"
DATASETS[8]="epstein-dataset-8.zip"
DATASETS[9]="epstein-dataset-9.zip"
DATASETS[10]="epstein-dataset-10.zip"
DATASETS[11]="epstein-dataset-11.zip"
DATASETS[12]="epstein-dataset-12.zip"

download_dataset() {
  local num=$1
  local filename=${DATASETS[$num]}
  local url="${BASE_URL}/${filename}"
  local outdir="${OUTPUT_DIR}/dataset-${num}"

  echo "=== Downloading Dataset ${num} ==="
  mkdir -p "$outdir"

  # Download with resume support
  wget --continue -O "${outdir}/${filename}" "$url" || {
    echo "ERROR: Failed to download dataset ${num}"
    return 1
  }

  # Extract
  echo "Extracting ${filename}..."
  unzip -o "${outdir}/${filename}" -d "$outdir"

  echo "Dataset ${num} complete: ${outdir}"
}

# Single dataset mode
if [ -n "$1" ]; then
  download_dataset "$1"
  exit 0
fi

# Download all datasets
mkdir -p "$OUTPUT_DIR"
for i in $(seq 1 12); do
  download_dataset "$i"
done

echo "=== All datasets downloaded ==="
du -sh "$OUTPUT_DIR"
```

File: `scripts/estimate-costs.ts`

```typescript
// scripts/estimate-costs.ts
// Estimate processing costs for a directory of documents.
// Usage: npx tsx scripts/estimate-costs.ts ./data/raw/dataset-1/

import fs from 'fs'
import path from 'path'

const COST_PER_PAGE = {
  ocr: 0.0015,
  classification: 0.0002,
  chunking: 0.0,
  contextual_headers: 0.0005,
  embedding: 0.0001,
  entity_extraction: 0.001,
  relationship_mapping: 0.0008,
  redaction_detection: 0.0005,
  timeline_extraction: 0.0005,
  summarization: 0.0003,
  criminal_indicators: 0.0008,
}

const AVG_PAGES_PER_PDF = 5

function countFiles(dir: string): { pdfs: number; images: number; audio: number; video: number } {
  const counts = { pdfs: 0, images: 0, audio: 0, video: 0 }

  function walk(d: string) {
    const entries = fs.readdirSync(d, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(d, entry.name)
      if (entry.isDirectory()) {
        walk(fullPath)
      } else {
        const ext = path.extname(entry.name).toLowerCase()
        if (['.pdf', '.doc', '.docx'].includes(ext)) counts.pdfs++
        else if (['.jpg', '.jpeg', '.png', '.gif', '.tiff', '.bmp'].includes(ext)) counts.images++
        else if (['.mp3', '.wav', '.m4a', '.ogg', '.flac'].includes(ext)) counts.audio++
        else if (['.mp4', '.avi', '.mov', '.mkv'].includes(ext)) counts.video++
      }
    }
  }

  walk(dir)
  return counts
}

function main() {
  const dir = process.argv[2]
  if (!dir) {
    console.error('Usage: npx tsx scripts/estimate-costs.ts <directory>')
    process.exit(1)
  }

  if (!fs.existsSync(dir)) {
    console.error(`Directory not found: ${dir}`)
    process.exit(1)
  }

  const counts = countFiles(dir)
  const totalPages = counts.pdfs * AVG_PAGES_PER_PDF + counts.images

  console.log('\n=== File Counts ===')
  console.log(`PDFs:   ${counts.pdfs}`)
  console.log(`Images: ${counts.images}`)
  console.log(`Audio:  ${counts.audio}`)
  console.log(`Video:  ${counts.video}`)
  console.log(`Est. total pages: ${totalPages}`)

  console.log('\n=== Cost Breakdown (per page) ===')
  let totalCostPerPage = 0
  for (const [stage, cost] of Object.entries(COST_PER_PAGE)) {
    console.log(`  ${stage.padEnd(25)} $${cost.toFixed(4)}`)
    totalCostPerPage += cost
  }
  console.log(`  ${'TOTAL per page'.padEnd(25)} $${totalCostPerPage.toFixed(4)}`)

  const totalCost = totalPages * totalCostPerPage
  const audioCost = counts.audio * 0.10 // ~$0.10 per audio file (Whisper)
  const videoCost = counts.video * 0.15 // ~$0.15 per video file

  console.log('\n=== Estimated Total Cost ===')
  console.log(`  Document processing: $${totalCost.toFixed(2)}`)
  console.log(`  Audio transcription: $${audioCost.toFixed(2)}`)
  console.log(`  Video transcription: $${videoCost.toFixed(2)}`)
  console.log(`  ────────────────────────`)
  console.log(`  TOTAL:               $${(totalCost + audioCost + videoCost).toFixed(2)}`)
  console.log(`\n  Cost per $1 donated: ~${Math.round(1 / totalCostPerPage)} pages processed`)
}

main()
```

File: `scripts/ingest-directory.ts`

```typescript
// scripts/ingest-directory.ts
// Ingest a local directory of files into the processing pipeline.
// Usage: npx tsx scripts/ingest-directory.ts ./data/raw/dataset-1/ --dataset-id <uuid>

import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

async function main() {
  const dir = process.argv[2]
  const datasetIdFlag = process.argv.indexOf('--dataset-id')
  const datasetId = datasetIdFlag !== -1 ? process.argv[datasetIdFlag + 1] : null

  if (!dir) {
    console.error('Usage: npx tsx scripts/ingest-directory.ts <directory> [--dataset-id <uuid>]')
    process.exit(1)
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Walk directory and find all processable files
  const files: string[] = []
  const EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.tiff', '.doc', '.docx']

  function walk(d: string) {
    const entries = fs.readdirSync(d, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(d, entry.name)
      if (entry.isDirectory()) walk(fullPath)
      else if (EXTENSIONS.includes(path.extname(entry.name).toLowerCase())) {
        files.push(fullPath)
      }
    }
  }

  walk(dir)
  console.log(`Found ${files.length} files to ingest`)

  let ingested = 0
  for (const filePath of files) {
    const filename = path.basename(filePath)
    const ext = path.extname(filename).toLowerCase()
    const mimeTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.tiff': 'image/tiff',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    }

    try {
      // Upload to Supabase Storage
      const fileBuffer = fs.readFileSync(filePath)
      const storagePath = `uploads/${datasetId || 'unassigned'}/${filename}`

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(storagePath, fileBuffer, {
          contentType: mimeTypes[ext] || 'application/octet-stream',
          upsert: true,
        })

      if (uploadError) {
        console.warn(`Failed to upload ${filename}: ${uploadError.message}`)
        continue
      }

      // Create document record
      const { data: doc, error: insertError } = await supabase
        .from('documents')
        .insert({
          dataset_id: datasetId,
          filename,
          original_path: filePath,
          storage_path: storagePath,
          file_type: ext.replace('.', ''),
          mime_type: mimeTypes[ext],
          file_size_bytes: fileBuffer.length,
          processing_status: 'pending',
        })
        .select('id')
        .single()

      if (insertError) {
        console.warn(`Failed to insert document record for ${filename}: ${insertError.message}`)
        continue
      }

      // Create processing job
      await supabase.from('processing_jobs').insert({
        document_id: doc.id,
        job_type: 'process_document',
        status: 'pending',
        priority: 0,
      })

      ingested++
      if (ingested % 100 === 0) {
        console.log(`Ingested ${ingested}/${files.length} files...`)
      }
    } catch (err) {
      console.warn(`Error ingesting ${filename}:`, err)
    }
  }

  console.log(`\nIngestion complete: ${ingested}/${files.length} files queued for processing`)
}

main().catch(console.error)
```

---

## Gotchas

1. **Worker is a separate project.** It has its own `package.json`, `node_modules`, and `tsconfig.json` inside `worker/`. Do NOT install worker dependencies in the root project. Run `cd worker && pnpm install` and `cd worker && pnpm dev` separately from the main Next.js app.

2. **Service role key, not anon key.** The worker needs `SUPABASE_SERVICE_ROLE_KEY` because it writes to all tables (documents, chunks, entities, etc.) without RLS restrictions. The anon key would fail on most operations. Never expose the service role key in client-side code — it lives only in `worker/.env`.

3. **Redis is optional.** The `BullMQJobQueue` requires Redis but the `PollingJobQueue` does not. If `REDIS_URL` is not set, the worker automatically falls back to polling the `processing_jobs` table every 5 seconds. Polling works fine for single-worker setups; use BullMQ for multi-worker deployments.

4. **Embedding dimensions must match the database schema.** The `chunks.content_embedding` column is `VECTOR(768)` and `images.description_embedding` is `VECTOR(1408)`. If you pass embeddings of the wrong dimension, Supabase will reject the insert. Double-check that `text-embedding-004` is configured for 768d output (`outputDimensionality: 768`).

5. **Rate limits are real.** Google AI has per-minute rate limits. The pipeline includes `await new Promise(r => setTimeout(r, 200))` delays between batches. If you see 429 errors, increase the delay or reduce `EMBEDDING_BATCH_SIZE`. Cohere's free tier is 100 requests/minute.

6. **OCR text can be huge.** A 50-page PDF produces 50K+ characters of OCR text. The `documents.ocr_text` column is `TEXT` (unlimited) but Gemini's context window is 1M tokens. For the classifier and summarizer, we sample first 3K-8K + last 1K-2K chars to stay within cost limits.

7. **Entity extraction is not idempotent.** Re-running the entity extractor on the same document will create duplicate `entity_mentions` records. The chunker and embedding stages ARE idempotent (they delete and recreate). If you need to re-run entity extraction, first delete existing mentions for that document.

8. **Contextual headers use the Anthropic "Contextual Retrieval" technique.** Each chunk gets a short header that says "This chunk is from document X, section Y, discussing Z." This dramatically improves embedding quality because `text-embedding-004` embeds the header + content together. Without it, a chunk like "He said yes" has no context.

9. **The cascade engine requires the `find_similar_redactions` RPC.** This function must be created in a Supabase migration (Phase 2) for vector similarity search on the `redactions.context_embedding` column. Without it, the cascade engine logs a warning and returns zero matches.

10. **Chat API uses SSE (Server-Sent Events), not WebSockets.** This is simpler to implement and works through most proxies. The client reads events from `POST /chat` using an EventSource-compatible reader. Each event has a `type` field: `start`, `tool_used`, `content`, `done`.

11. **Gemini function calling syntax differs from OpenAI.** Gemini uses `functionDeclarations` inside a `tools` array, and returns `functionCall` parts instead of `tool_calls`. The chat orchestrator handles this mapping internally.

12. **All pipeline stages must handle missing data gracefully.** A document might have no images (skip visual embedding), no dates (skip timeline), or no [REDACTED] markers (skip redaction detection). Stages should log a message and return successfully rather than throwing.

13. **The worker shares AI interfaces with the main project.** The `tsconfig.json` includes path aliases `@/lib/*` and `@/types/*` pointing to the parent directory. This avoids duplicating type definitions. If this causes issues, copy the relevant type files into `worker/src/types/`.

---

## Files to Create

```
worker/
├── package.json
├── tsconfig.json
├── .env.example
└── src/
    ├── index.ts
    ├── pipeline/
    │   ├── orchestrator.ts
    │   ├── job-queue.ts
    │   └── stages.ts
    ├── services/
    │   ├── document-ai-ocr.ts
    │   ├── classifier.ts
    │   ├── smart-chunker.ts
    │   ├── contextual-header-gen.ts
    │   ├── embedding-service.ts
    │   ├── embedding-cache.ts
    │   ├── visual-embedding-service.ts
    │   ├── entity-extractor.ts
    │   ├── relationship-mapper.ts
    │   ├── redaction-detector.ts
    │   ├── timeline-extractor.ts
    │   ├── document-summarizer.ts
    │   ├── criminal-indicator-scorer.ts
    │   ├── cascade-engine.ts
    │   ├── audio-processor.ts
    │   ├── structured-extractor.ts
    │   ├── video-transcriber.ts
    │   ├── entity-merge-detector.ts
    │   ├── pattern-detector.ts
    │   ├── cohere-reranker.ts
    │   └── hint-processor.ts
    ├── chatbot/
    │   ├── chat-orchestrator.ts
    │   ├── rag-retrieval.ts
    │   ├── intent-classifier.ts
    │   ├── conversation-memory.ts
    │   └── tools/
    │       ├── search-documents.ts
    │       ├── search-images.ts
    │       ├── lookup-entity.ts
    │       ├── map-connections.ts
    │       ├── build-timeline.ts
    │       ├── cross-reference.ts
    │       ├── search-by-date.ts
    │       └── find-similar.ts
    └── api/
        └── chat.ts
scripts/
├── download-datasets.sh
├── download-dataset.sh
├── seed-sample-data.ts
├── ingest-directory.ts
└── estimate-costs.ts
```

## Acceptance Criteria

1. `cd worker && pnpm install && pnpm dev` starts the worker (Express server listening on port 3001)
2. `GET http://localhost:3001/health` returns `{ status: "ok" }` with 200
3. Pipeline orchestrator runs through all 12 stages with real implementations (Gemini API calls)
4. Document processing updates `documents.processing_status` through: `pending` -> `ocr` -> `classifying` -> `chunking` -> `embedding` -> `entity_extraction` -> `relationship_mapping` -> `redaction_detection` -> `summarizing` -> `complete`
5. OCR stage extracts text from a PDF and stores it in `documents.ocr_text`
6. Classifier assigns one of 16 document types with confidence score
7. Smart chunker produces chunks of 400-1500 chars respecting section boundaries
8. Contextual headers are generated for each chunk (50-100 tokens each)
9. Text embeddings (768d) are generated and stored for all chunks
10. Entity extraction finds people, organizations, and locations from chunk text
11. Relationship mapper creates `entity_relationships` records between co-occurring entities
12. Redaction detector finds `[REDACTED]` markers and creates `redactions` records
13. Document summarizer generates executive summary stored in `documents.metadata`
14. Criminal indicator scorer flags patterns without making accusations
15. Cascade engine finds similar unsolved redactions and creates proposals
16. Chat API (`POST /chat`) returns streaming SSE response with tool usage and citations
17. Chat orchestrator calls tools (search, entity lookup, timeline) and includes results in response
18. Embedding cache returns cached embeddings without calling the provider
19. `scripts/download-datasets.sh` is executable and handles resume on interruption
20. `scripts/estimate-costs.ts` outputs cost breakdown for a sample directory
21. `scripts/ingest-directory.ts` uploads files to Supabase Storage and creates processing jobs
22. All services use Google AI API (Gemini) with proper error handling and retry logic
23. Error handling: failed stages retry up to 3 times with exponential backoff, then mark as `failed`
24. Graceful shutdown: `SIGINT`/`SIGTERM` waits for active jobs to complete before exiting
25. Job queue works in polling mode (no Redis) — claims and processes jobs from `processing_jobs` table

## Design Notes

- Pipeline stages run sequentially per document — no parallelism within a single document's pipeline
- Multiple documents CAN process in parallel (controlled by `WORKER_CONCURRENCY`)
- The worker is stateless — all state lives in Supabase. You can run multiple worker instances
- Cost estimate: ~$0.005 per page all-in (OCR + embed + entity + summary). $5 donation = ~1,000 pages
- Audio/video transcription uses OpenAI Whisper; all other AI uses Google Gemini
- The chat orchestrator uses Gemini's native function-calling, not a text-based tool-calling hack
- Entity deduplication is by exact name+type match. Fuzzy matching (embedding similarity) is handled by the entity-merge-detector as a separate background job, not inline during extraction

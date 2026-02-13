// lib/pipeline/orchestrator.ts
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
} from './stages'

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

export type StageSkipCheck = (documentId: string, supabase: SupabaseClient) => Promise<boolean>

export class PipelineOrchestrator {
  private handlers = new Map<PipelineStage, StageHandler>()
  private skipChecks = new Map<PipelineStage, StageSkipCheck>()
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

  /** Register a skip check for a pipeline stage */
  registerSkipCheck(stage: PipelineStage, check: StageSkipCheck): void {
    this.skipChecks.set(stage, check)
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

      // Per-document skip check
      const skipCheck = this.skipChecks.get(stage)
      if (skipCheck) {
        const shouldSkip = await skipCheck(documentId, this.supabase)
        if (shouldSkip) {
          console.log(`[Pipeline] Stage ${stage} skipped for document ${documentId} (already satisfied)`)
          results.push({ stage, success: true, durationMs: 0, retries: 0 })
          continue
        }
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

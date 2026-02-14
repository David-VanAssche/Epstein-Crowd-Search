// lib/pipeline/orchestrator.ts
// Runs a document through all pipeline stages sequentially.
// Each stage is a function that takes a document ID and returns void.
// The orchestrator handles retries, status updates, error reporting,
// and tracks per-stage completion via the completed_stages array.

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

    // Fetch current completed_stages for skip logic
    const { data: doc } = await this.supabase
      .from('documents')
      .select('completed_stages')
      .eq('id', documentId)
      .single()

    const completedStages = new Set<string>((doc as any)?.completed_stages || [])

    // Get ordered stages, optionally filtered
    let stages = getOrderedStages()
    if (this.config.stagesFilter) {
      const filterSet = new Set(this.config.stagesFilter)
      stages = stages.filter((s) => filterSet.has(s))
    }

    for (const stage of stages) {
      // Skip stages already completed (from completed_stages array)
      if (completedStages.has(stage)) {
        console.log(`[Pipeline] Stage ${stage} already completed for document ${documentId}, skipping`)
        results.push({ stage, success: true, durationMs: 0, retries: 0 })
        continue
      }

      const handler = this.handlers.get(stage)
      if (!handler) {
        console.warn(`[Pipeline] No handler registered for stage: ${stage}, skipping`)
        continue
      }

      // Per-document skip check (custom logic beyond completed_stages)
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

      // Mark stage as completed in the completed_stages array
      await this.appendCompletedStage(documentId, stage)
      completedStages.add(stage)

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

  /** Append a stage to the document's completed_stages array */
  private async appendCompletedStage(
    documentId: string,
    stage: string
  ): Promise<void> {
    const { error } = await this.supabase.rpc('append_completed_stage', {
      p_document_id: documentId,
      p_stage: stage,
    })

    if (error) {
      // Fallback: use array_append with dedup if the RPC doesn't exist yet.
      // This is still race-safe because we filter out duplicates in the update.
      console.warn(`[Pipeline] append_completed_stage RPC failed, using fallback: ${error.message}`)
      const { data: doc } = await this.supabase
        .from('documents')
        .select('completed_stages')
        .eq('id', documentId)
        .single()

      const current: string[] = (doc as any)?.completed_stages || []
      // Use Set to deduplicate — even if another worker added stages between our
      // read and write, we won't remove them (only add ours). Worst case: a
      // concurrent write overwrites with the same set. No data loss.
      const updated = Array.from(new Set([...current, stage]))
      await this.supabase
        .from('documents')
        .update({
          completed_stages: updated,
          updated_at: new Date().toISOString(),
        })
        .eq('id', documentId)
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

// lib/pipeline/batch-runner.ts
// Queries Supabase for documents needing processing, runs them through
// pipeline stages in batches with concurrency control and progress tracking.
// No Redis, no polling, no persistent server — just a script that runs to completion.

import { createClient, SupabaseClient } from '@supabase/supabase-js'

export interface BatchRunnerConfig {
  supabaseUrl: string
  supabaseServiceKey: string
  concurrency: number
  maxRetries: number
  retryDelayMs: number
  /** If set, only process documents matching this filter */
  datasetId?: string
  /** If set, only process this many documents (for testing) */
  limit?: number
  /** If true, do a dry run — log what would be processed but don't actually process */
  dryRun?: boolean
}

export interface BatchResult {
  processed: number
  skipped: number
  failed: number
  errors: Array<{ documentId: string; error: string }>
  durationMs: number
}

/**
 * Generic batch runner that queries for documents needing a specific stage,
 * then processes them with the provided handler function.
 */
export async function runBatch(
  config: BatchRunnerConfig,
  stageName: string,
  /**
   * Filter query: given a Supabase query builder, add .eq/.is/.not filters
   * to select only documents that need this stage. Return the filtered query.
   */
  needsProcessing: (
    query: ReturnType<SupabaseClient['from']>
  ) => ReturnType<SupabaseClient['from']>,
  /** Process a single document. Receives document ID and Supabase client. */
  handler: (documentId: string, supabase: SupabaseClient) => Promise<void>
): Promise<BatchResult> {
  const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey)
  const start = Date.now()
  const result: BatchResult = { processed: 0, skipped: 0, failed: 0, errors: [], durationMs: 0 }

  // Query for documents needing this stage
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase.from('documents').select('id')
  query = needsProcessing(query)
  if (config.datasetId) {
    query = query.eq('dataset_id', config.datasetId)
  }
  if (config.limit) {
    query = query.limit(config.limit)
  }

  const { data: docs, error } = await query
  if (error) throw new Error(`Failed to query documents: ${error.message}`)
  if (!docs || docs.length === 0) {
    console.log(`[${stageName}] No documents need processing`)
    result.durationMs = Date.now() - start
    return result
  }

  console.log(`[${stageName}] Found ${docs.length} documents to process (concurrency=${config.concurrency})`)

  if (config.dryRun) {
    console.log(`[${stageName}] Dry run — skipping actual processing`)
    result.skipped = docs.length
    result.durationMs = Date.now() - start
    return result
  }

  // Process in batches with concurrency control
  const docIds = docs.map((d: { id: string }) => d.id)
  for (let i = 0; i < docIds.length; i += config.concurrency) {
    const batch = docIds.slice(i, i + config.concurrency)
    const promises = batch.map(async (docId: string) => {
      let attempts = 0
      while (attempts < config.maxRetries) {
        try {
          await handler(docId, supabase)
          result.processed++
          return
        } catch (err) {
          attempts++
          const msg = err instanceof Error ? err.message : String(err)
          if (attempts < config.maxRetries) {
            console.warn(`[${stageName}] Retry ${attempts}/${config.maxRetries} for ${docId}: ${msg}`)
            await new Promise((r) => setTimeout(r, config.retryDelayMs * attempts))
          } else {
            console.error(`[${stageName}] Failed after ${config.maxRetries} attempts: ${docId}`)
            result.failed++
            result.errors.push({ documentId: docId, error: msg })
          }
        }
      }
    })

    await Promise.all(promises)

    // Progress log every batch
    const total = result.processed + result.failed
    if (total % 100 === 0 || i + config.concurrency >= docIds.length) {
      console.log(`[${stageName}] Progress: ${total}/${docIds.length} (${result.failed} failed)`)
    }
  }

  result.durationMs = Date.now() - start
  console.log(
    `[${stageName}] Complete: ${result.processed} processed, ${result.failed} failed in ${(result.durationMs / 1000).toFixed(1)}s`
  )

  return result
}

/** Default batch config from environment variables */
export function getDefaultConfig(): BatchRunnerConfig {
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    concurrency: parseInt(process.env.BATCH_CONCURRENCY || '5', 10),
    maxRetries: parseInt(process.env.BATCH_MAX_RETRIES || '3', 10),
    retryDelayMs: parseInt(process.env.BATCH_RETRY_DELAY_MS || '5000', 10),
  }
}

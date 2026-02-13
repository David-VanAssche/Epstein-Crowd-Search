// scripts/batch/run-all.ts
// Master batch script that runs all pipeline stages in order.
// Usage: npx tsx scripts/batch/run-all.ts [--dataset-id <uuid>] [--limit N] [--dry-run] [--stage embed]

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { PipelineOrchestrator } from '../../lib/pipeline/orchestrator'
import { PipelineStage } from '../../lib/pipeline/stages'
import { getDefaultConfig } from '../../lib/pipeline/batch-runner'

// --- Import stage handlers ---
import { handleOCR } from '../../lib/pipeline/services/document-ai-ocr'
import { handleClassify } from '../../lib/pipeline/services/classifier'
import { handleChunk } from '../../lib/pipeline/services/smart-chunker'
import { handleContextualHeaders } from '../../lib/pipeline/services/contextual-header-gen'
import { handleEmbed } from '../../lib/pipeline/services/embedding-service'
import { handleVisualEmbed } from '../../lib/pipeline/services/visual-embedding-service'
import { handleEntityExtract } from '../../lib/pipeline/services/entity-extractor'
import { handleRelationshipMap } from '../../lib/pipeline/services/relationship-mapper'
import { handleRedactionDetect } from '../../lib/pipeline/services/redaction-detector'
import { handleTimelineExtract } from '../../lib/pipeline/services/timeline-extractor'
import { handleSummarize } from '../../lib/pipeline/services/document-summarizer'
import { handleCriminalIndicators } from '../../lib/pipeline/services/criminal-indicator-scorer'

// --- Parse CLI args ---
const args = process.argv.slice(2)
const datasetIdIdx = args.indexOf('--dataset-id')
const limitIdx = args.indexOf('--limit')
const stageIdx = args.indexOf('--stage')
const dryRun = args.includes('--dry-run')

const datasetId = datasetIdIdx !== -1 ? args[datasetIdIdx + 1] : undefined
const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : undefined
const stageFilter = stageIdx !== -1 ? args[stageIdx + 1] : undefined

// --- Environment validation ---
const REQUIRED_ENV = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`)
    process.exit(1)
  }
}

async function main() {
  const config = getDefaultConfig()
  const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey)

  console.log('[Batch] Starting pipeline processing')
  console.log(`[Batch] Concurrency: ${config.concurrency}`)
  if (datasetId) console.log(`[Batch] Dataset filter: ${datasetId}`)
  if (limit) console.log(`[Batch] Limit: ${limit} documents`)
  if (stageFilter) console.log(`[Batch] Stage filter: ${stageFilter}`)
  if (dryRun) console.log(`[Batch] DRY RUN — no actual processing`)

  // --- Pipeline orchestrator ---
  const pipeline = new PipelineOrchestrator(supabase, {
    maxRetries: config.maxRetries,
    retryDelayMs: config.retryDelayMs,
    stagesFilter: stageFilter
      ? [stageFilter as PipelineStage]
      : undefined,
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

  // --- Skip check registrations ---
  pipeline.registerSkipCheck(PipelineStage.OCR, async (docId, sb) => {
    const { data } = await sb.from('documents')
      .select('ocr_text').eq('id', docId).single()
    return !!(data as any)?.ocr_text
  })

  pipeline.registerSkipCheck(PipelineStage.CHUNK, async (docId, sb) => {
    const { count } = await sb.from('chunks')
      .select('id', { count: 'exact', head: true })
      .eq('document_id', docId)
      .not('content_embedding', 'is', null)
    return (count ?? 0) > 0
  })

  pipeline.registerSkipCheck(PipelineStage.ENTITY_EXTRACT, async (docId, sb) => {
    const { count } = await sb.from('entity_mentions')
      .select('id', { count: 'exact', head: true })
      .eq('document_id', docId)
    return (count ?? 0) > 0
  })

  // --- Query for documents needing processing ---
  let query = supabase.from('documents').select('id')
    .not('processing_status', 'eq', 'complete') as any
  if (datasetId) query = query.eq('dataset_id', datasetId)
  if (limit) query = query.limit(limit)

  const { data: docs, error } = await query
  if (error) throw new Error(`Failed to query documents: ${error.message}`)
  if (!docs || docs.length === 0) {
    console.log('[Batch] No documents need processing. Done.')
    return
  }

  console.log(`[Batch] Processing ${docs.length} documents...`)

  if (dryRun) {
    console.log('[Batch] Dry run complete. Would process the above documents.')
    return
  }

  // Process documents with concurrency control
  let processed = 0, failed = 0
  for (let i = 0; i < docs.length; i += config.concurrency) {
    const batch = docs.slice(i, i + config.concurrency)
    const results = await Promise.allSettled(
      batch.map((doc: { id: string }) => pipeline.processDocument(doc.id))
    )

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.success) processed++
      else failed++
    }

    console.log(`[Batch] Progress: ${processed + failed}/${docs.length} (${failed} failed)`)
  }

  console.log(`\n[Batch] Complete: ${processed} processed, ${failed} failed`)
}

main().catch((err) => {
  console.error('[Batch] Fatal error:', err)
  process.exit(1)
})

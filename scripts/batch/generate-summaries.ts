// scripts/batch/generate-summaries.ts
// Single-stage batch script: document summarization only.

import 'dotenv/config'
import { runBatch, getDefaultConfig } from '../../lib/pipeline/batch-runner'
import { handleSummarize } from '../../lib/pipeline/services/document-summarizer'

const args = process.argv.slice(2)
const datasetIdIdx = args.indexOf('--dataset-id')
const limitIdx = args.indexOf('--limit')

const config = getDefaultConfig()
config.datasetId = datasetIdIdx !== -1 ? args[datasetIdIdx + 1] : undefined
config.limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : undefined
config.dryRun = args.includes('--dry-run')

runBatch(
  config,
  'Summarize',
  (query: any) => query.eq('processing_status', 'entity_extraction'),
  handleSummarize
).then((result) => {
  console.log(`\nSummarization batch complete:`, result)
  process.exit(result.failed > 0 ? 1 : 0)
}).catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})

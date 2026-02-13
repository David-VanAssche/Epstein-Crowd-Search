// scripts/batch/classify-docs.ts
// Single-stage batch script: document classification only.

import 'dotenv/config'
import { runBatch, getDefaultConfig } from '../../lib/pipeline/batch-runner'
import { handleClassify } from '../../lib/pipeline/services/classifier'

const args = process.argv.slice(2)
const datasetIdIdx = args.indexOf('--dataset-id')
const limitIdx = args.indexOf('--limit')

const config = getDefaultConfig()
config.datasetId = datasetIdIdx !== -1 ? args[datasetIdIdx + 1] : undefined
config.limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : undefined
config.dryRun = args.includes('--dry-run')

runBatch(
  config,
  'Classify',
  (query: any) => query.eq('processing_status', 'ocr'),
  handleClassify
).then((result) => {
  console.log(`\nClassification batch complete:`, result)
  process.exit(result.failed > 0 ? 1 : 0)
}).catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})

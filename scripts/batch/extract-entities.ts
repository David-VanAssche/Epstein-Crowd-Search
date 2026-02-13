// scripts/batch/extract-entities.ts
// Single-stage batch script: entity extraction only.

import 'dotenv/config'
import { runBatch, getDefaultConfig } from '../../lib/pipeline/batch-runner'
import { handleEntityExtract } from '../../lib/pipeline/services/entity-extractor'

const args = process.argv.slice(2)
const datasetIdIdx = args.indexOf('--dataset-id')
const limitIdx = args.indexOf('--limit')

const config = getDefaultConfig()
config.datasetId = datasetIdIdx !== -1 ? args[datasetIdIdx + 1] : undefined
config.limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : undefined
config.dryRun = args.includes('--dry-run')

runBatch(
  config,
  'EntityExtract',
  (query: any) => query.in('processing_status', ['chunking', 'embedding']),
  handleEntityExtract
).then((result) => {
  console.log(`\nEntity extraction batch complete:`, result)
  process.exit(result.failed > 0 ? 1 : 0)
}).catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})

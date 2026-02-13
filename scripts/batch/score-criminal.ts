// scripts/batch/score-criminal.ts
// Single-stage batch script: criminal indicator scoring only.

import 'dotenv/config'
import { runBatch, getDefaultConfig } from '../../lib/pipeline/batch-runner'
import { handleCriminalIndicators } from '../../lib/pipeline/services/criminal-indicator-scorer'

const args = process.argv.slice(2)
const datasetIdIdx = args.indexOf('--dataset-id')
const limitIdx = args.indexOf('--limit')

const config = getDefaultConfig()
config.datasetId = datasetIdIdx !== -1 ? args[datasetIdIdx + 1] : undefined
config.limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : undefined
config.dryRun = args.includes('--dry-run')

runBatch(
  config,
  'CriminalIndicators',
  (query: any) => query.in('processing_status', ['entity_extraction', 'relationship_mapping']),
  handleCriminalIndicators
).then((result) => {
  console.log(`\nCriminal indicator scoring batch complete:`, result)
  process.exit(result.failed > 0 ? 1 : 0)
}).catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})

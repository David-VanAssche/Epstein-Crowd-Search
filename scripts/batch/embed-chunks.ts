// scripts/batch/embed-chunks.ts
// Single-stage batch script: embedding only.
// Usage: npx tsx scripts/batch/embed-chunks.ts [--dataset-id <uuid>] [--limit N] [--dry-run]

import 'dotenv/config'
import { runBatch, getDefaultConfig } from '../../lib/pipeline/batch-runner'
import { handleEmbed } from '../../lib/pipeline/services/embedding-service'

const args = process.argv.slice(2)
const datasetIdIdx = args.indexOf('--dataset-id')
const limitIdx = args.indexOf('--limit')

const config = getDefaultConfig()
config.datasetId = datasetIdIdx !== -1 ? args[datasetIdIdx + 1] : undefined
config.limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : undefined
config.dryRun = args.includes('--dry-run')

runBatch(
  config,
  'Embed',
  (query: any) => query.eq('processing_status', 'chunking'),
  handleEmbed
).then((result) => {
  console.log(`\nEmbed batch complete:`, result)
  process.exit(result.failed > 0 ? 1 : 0)
}).catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})

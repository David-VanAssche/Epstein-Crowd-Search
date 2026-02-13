// scripts/batch/process-media.ts
// Single-stage batch script: audio/video processing only.

import 'dotenv/config'
import { runBatch, getDefaultConfig } from '../../lib/pipeline/batch-runner'
import { handleAudioProcess } from '../../lib/pipeline/services/audio-processor'

const args = process.argv.slice(2)
const datasetIdIdx = args.indexOf('--dataset-id')
const limitIdx = args.indexOf('--limit')

const config = getDefaultConfig()
config.datasetId = datasetIdIdx !== -1 ? args[datasetIdIdx + 1] : undefined
config.limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : undefined
config.dryRun = args.includes('--dry-run')

runBatch(
  config,
  'MediaProcess',
  (query: any) => query.in('mime_type', ['audio/mpeg', 'audio/wav', 'audio/mp4', 'video/mp4', 'video/quicktime']).eq('processing_status', 'pending'),
  handleAudioProcess
).then((result) => {
  console.log(`\nMedia processing batch complete:`, result)
  process.exit(result.failed > 0 ? 1 : 0)
}).catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})

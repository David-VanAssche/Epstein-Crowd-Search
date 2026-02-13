// scripts/batch/compute-network-metrics.ts
// Compute PageRank, betweenness centrality, and community detection.
// Usage: npx tsx scripts/batch/compute-network-metrics.ts [--dry-run] [--iterations N] [--samples N]

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { NetworkMetricsService } from '../../lib/pipeline/services/network-metrics'

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const iterIdx = args.indexOf('--iterations')
const samplesIdx = args.indexOf('--samples')

const pagerankIterations = iterIdx !== -1 ? parseInt(args[iterIdx + 1], 10) : 20
const betweennessSamples = samplesIdx !== -1 ? parseInt(args[samplesIdx + 1], 10) : 200

const REQUIRED_ENV = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`)
    process.exit(1)
  }
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const metrics = new NetworkMetricsService(supabase)
  const result = await metrics.computeAll({
    dryRun,
    pagerankIterations,
    betweennessSamples,
  })

  console.log(`\nFinal: ${result.entityCount} entities, ${result.edgeCount} edges, ${result.clusterCount} clusters`)
}

main().catch((err) => {
  console.error('[NetworkMetrics] Fatal error:', err)
  process.exit(1)
})

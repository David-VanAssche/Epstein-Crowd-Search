// scripts/batch/generate-co-flight-links.ts
// Generate traveled_with and communicated_with relationships from co-occurrence data.
// Usage: npx tsx scripts/batch/generate-co-flight-links.ts [--dry-run]

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { CoFlightLinkerService } from '../../lib/pipeline/services/co-flight-linker'

const dryRun = process.argv.includes('--dry-run')

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

  const linker = new CoFlightLinkerService(supabase)
  const result = await linker.generateAllLinks({ dryRun })

  console.log(`\nFinal: ${result.traveledWith} traveled_with, ${result.communicatedWith} communicated_with, ${result.failed} failed`)
}

main().catch((err) => {
  console.error('[CoFlightLinks] Fatal error:', err)
  process.exit(1)
})

// scripts/batch/categorize-persons.ts
// Batch classify person entities into sub-categories using LLM.
// Usage: npx tsx scripts/batch/categorize-persons.ts [--limit N] [--dry-run] [--overwrite]

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { PersonCategorizerService } from '../../lib/pipeline/services/person-categorizer'

const args = process.argv.slice(2)
const limitIdx = args.indexOf('--limit')
const dryRun = args.includes('--dry-run')
const overwrite = args.includes('--overwrite')

const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : undefined

const REQUIRED_ENV = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'GEMINI_API_KEY']
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

  console.log('[BatchCategorize] Starting person categorization')
  if (limit) console.log(`[BatchCategorize] Limit: ${limit}`)
  if (dryRun) console.log('[BatchCategorize] DRY RUN')
  if (overwrite) console.log('[BatchCategorize] Will overwrite existing categories')

  const categorizer = new PersonCategorizerService(supabase)
  const result = await categorizer.categorizeAll({ limit, dryRun, overwrite })

  console.log(`\n[BatchCategorize] Final: ${result.categorized} categorized, ${result.failed} failed, ${result.skipped} skipped`)
}

main().catch((err) => {
  console.error('[BatchCategorize] Fatal error:', err)
  process.exit(1)
})

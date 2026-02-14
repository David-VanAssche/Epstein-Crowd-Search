// scripts/batch/precompute-cascades.ts
// Batch precompute potential_cascade_count for all unsolved redactions.
// Run after redaction detection or as periodic batch job.
// Usage: npx tsx scripts/batch/precompute-cascades.ts

import { createClient } from '@supabase/supabase-js'

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  console.log('[Precompute] Starting cascade count refresh...')
  const start = Date.now()

  const { data, error } = await supabase.rpc('refresh_all_cascade_counts')

  if (error) {
    console.error('[Precompute] Error:', error.message)
    process.exit(1)
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log(`[Precompute] Updated ${data} redactions in ${elapsed}s`)
}

main()

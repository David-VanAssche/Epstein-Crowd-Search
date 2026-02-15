#!/usr/bin/env tsx
// scripts/entity-dedup.ts
// CLI script for detecting and merging duplicate entities.
//
// Usage:
//   pnpm tsx scripts/entity-dedup.ts              # Show candidates
//   pnpm tsx scripts/entity-dedup.ts --auto       # Auto-merge pairs above 0.95 similarity
//   pnpm tsx scripts/entity-dedup.ts --type person # Filter by entity type
//   pnpm tsx scripts/entity-dedup.ts --min 0.90   # Custom similarity threshold

import { createClient } from '@supabase/supabase-js'
import { detectEntityMerges } from '../lib/pipeline/services/entity-merge-detector'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function main() {
  const args = process.argv.slice(2)
  const autoMerge = args.includes('--auto')
  const typeIdx = args.indexOf('--type')
  const entityType = typeIdx >= 0 ? args[typeIdx + 1] : undefined
  const minIdx = args.indexOf('--min')
  const minSimilarity = minIdx >= 0 ? parseFloat(args[minIdx + 1]) : 0.85
  const autoThreshold = 0.95

  console.log(`Detecting entity duplicates (min similarity: ${minSimilarity})...`)
  if (entityType) console.log(`Filtering by type: ${entityType}`)

  const candidates = await detectEntityMerges(supabase, {
    minSimilarity,
    entityType,
  })

  if (candidates.length === 0) {
    console.log('No duplicate candidates found.')
    return
  }

  console.log(`\nFound ${candidates.length} candidate pairs:\n`)

  for (const c of candidates) {
    const simPct = (c.similarity * 100).toFixed(1)
    console.log(
      `  [${simPct}%] "${c.entityAName}" <-> "${c.entityBName}" (${c.entityType})`
    )
  }

  if (autoMerge) {
    const autoMergeable = candidates.filter((c) => c.similarity >= autoThreshold)
    console.log(
      `\nAuto-merging ${autoMergeable.length} pairs above ${(autoThreshold * 100).toFixed(0)}% similarity...`
    )

    for (const c of autoMergeable) {
      try {
        const { error } = await supabase.rpc('merge_entities', {
          p_keep: c.entityA,
          p_remove: c.entityB,
        })

        if (error) {
          console.error(`  Failed to merge "${c.entityBName}" into "${c.entityAName}": ${error.message}`)
        } else {
          console.log(`  Merged "${c.entityBName}" -> "${c.entityAName}"`)
        }
      } catch (err) {
        console.error(`  Error merging: ${err}`)
      }
    }

    console.log('\nDone.')
  } else {
    console.log('\nRun with --auto to auto-merge pairs above 95% similarity.')
  }
}

main().catch(console.error)

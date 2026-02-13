// scripts/batch/extract-financial.ts
// Batch extract financial transactions from documents classified as financial records.
// Usage: npx tsx scripts/batch/extract-financial.ts [--dataset-id <uuid>] [--limit N] [--dry-run]

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { FinancialExtractorService } from '../../lib/pipeline/services/financial-extractor'

const args = process.argv.slice(2)
const datasetIdIdx = args.indexOf('--dataset-id')
const limitIdx = args.indexOf('--limit')
const dryRun = args.includes('--dry-run')

const datasetId = datasetIdIdx !== -1 ? args[datasetIdIdx + 1] : undefined
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

  console.log('[BatchFinancial] Starting financial extraction')
  if (datasetId) console.log(`[BatchFinancial] Dataset filter: ${datasetId}`)
  if (limit) console.log(`[BatchFinancial] Limit: ${limit}`)
  if (dryRun) console.log('[BatchFinancial] DRY RUN')

  const FINANCIAL_CLASSIFICATIONS = [
    'financial_record', 'tax_filing', 'trust_document',
    'bank_record', 'check', 'invoice', 'receipt',
  ]

  let query = supabase
    .from('documents')
    .select('id, filename, classification')
    .in('classification', FINANCIAL_CLASSIFICATIONS)
    .order('created_at', { ascending: true })

  if (datasetId) query = query.eq('dataset_id', datasetId)
  if (limit) query = query.limit(limit)

  const { data: docs, error } = await query
  if (error) throw new Error(`Query failed: ${error.message}`)
  if (!docs || docs.length === 0) {
    console.log('[BatchFinancial] No eligible documents found. Done.')
    return
  }

  // Filter out already processed
  const { data: existingDocs } = await supabase
    .from('financial_transactions')
    .select('document_id')

  const existingDocIds = new Set((existingDocs || []).map((e: any) => e.document_id))
  const pending = docs.filter((d: any) => !existingDocIds.has(d.id))

  console.log(`[BatchFinancial] ${docs.length} eligible docs, ${pending.length} need processing`)

  if (dryRun) {
    for (const doc of pending.slice(0, 10)) {
      console.log(`  [DRY RUN] Would process: ${(doc as any).filename} (${(doc as any).classification})`)
    }
    if (pending.length > 10) console.log(`  ... and ${pending.length - 10} more`)
    return
  }

  const extractor = new FinancialExtractorService(supabase)
  let processed = 0
  let failed = 0

  for (let i = 0; i < pending.length; i++) {
    const doc = pending[i] as any
    console.log(`[BatchFinancial] (${i + 1}/${pending.length}) ${doc.filename}`)

    try {
      const result = await extractor.extractFromDocument(doc.id)
      if (result.success) {
        processed++
        console.log(`  → Extracted ${result.transactionCount || 0} transactions`)
      } else {
        console.log(`  → Skipped: ${result.error}`)
      }
    } catch (err) {
      console.error(`  → Failed: ${err instanceof Error ? err.message : String(err)}`)
      failed++
    }

    if (i < pending.length - 1) {
      await new Promise((r) => setTimeout(r, 1000))
    }
  }

  console.log(`\n[BatchFinancial] Done: ${processed} processed, ${failed} failed`)
}

main().catch((err) => {
  console.error('[BatchFinancial] Fatal error:', err)
  process.exit(1)
})

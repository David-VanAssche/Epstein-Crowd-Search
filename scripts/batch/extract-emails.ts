// scripts/batch/extract-emails.ts
// Batch extract emails from documents classified as correspondence/email/memo.
// Usage: npx tsx scripts/batch/extract-emails.ts [--dataset-id <uuid>] [--limit N] [--dry-run]

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { EmailExtractorService } from '../../lib/pipeline/services/email-extractor'

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

  console.log('[BatchEmails] Starting email extraction')
  if (datasetId) console.log(`[BatchEmails] Dataset filter: ${datasetId}`)
  if (limit) console.log(`[BatchEmails] Limit: ${limit}`)
  if (dryRun) console.log('[BatchEmails] DRY RUN')

  const EMAIL_CLASSIFICATIONS = ['correspondence', 'email', 'memo', 'letter']

  // Find documents that are classified as email-like and don't already have emails extracted
  let query = supabase
    .from('documents')
    .select('id, filename, classification')
    .in('classification', EMAIL_CLASSIFICATIONS)
    .order('created_at', { ascending: true })

  if (datasetId) query = query.eq('dataset_id', datasetId)
  if (limit) query = query.limit(limit)

  const { data: docs, error } = await query
  if (error) throw new Error(`Query failed: ${error.message}`)
  if (!docs || docs.length === 0) {
    console.log('[BatchEmails] No eligible documents found. Done.')
    return
  }

  // Filter out docs that already have emails
  const { data: existingDocs } = await supabase
    .from('emails')
    .select('document_id')

  const existingDocIds = new Set((existingDocs || []).map((e: any) => e.document_id))
  const pending = docs.filter((d: any) => !existingDocIds.has(d.id))

  console.log(`[BatchEmails] ${docs.length} eligible docs, ${pending.length} need processing`)

  if (dryRun) {
    for (const doc of pending.slice(0, 10)) {
      console.log(`  [DRY RUN] Would process: ${(doc as any).filename} (${(doc as any).classification})`)
    }
    if (pending.length > 10) console.log(`  ... and ${pending.length - 10} more`)
    return
  }

  const extractor = new EmailExtractorService(supabase)
  let processed = 0
  let failed = 0

  for (let i = 0; i < pending.length; i++) {
    const doc = pending[i] as any
    console.log(`[BatchEmails] (${i + 1}/${pending.length}) ${doc.filename}`)

    try {
      const result = await extractor.extractFromDocument(doc.id)
      if (result.success) {
        processed++
        console.log(`  → Extracted ${result.emailCount || 0} emails`)
      } else {
        console.log(`  → Skipped: ${result.error}`)
      }
    } catch (err) {
      console.error(`  → Failed: ${err instanceof Error ? err.message : String(err)}`)
      failed++
    }

    // Rate limit
    if (i < pending.length - 1) {
      await new Promise((r) => setTimeout(r, 1000))
    }
  }

  console.log(`\n[BatchEmails] Done: ${processed} processed, ${failed} failed`)
}

main().catch((err) => {
  console.error('[BatchEmails] Fatal error:', err)
  process.exit(1)
})

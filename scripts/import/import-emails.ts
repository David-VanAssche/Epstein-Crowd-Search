import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const STORAGE_PREFIX = 'github/erikveland'
const BATCH_SIZE = 50
const COMPLETED_STAGES = ['ocr', 'classify', 'email_extract']

interface ParsedEmail {
  messageId: string | null
  subject: string | null
  from: string | null
  to: string[]
  cc: string[]
  bcc: string[]
  date: string | null
  inReplyTo: string | null
  references: string | null
  body: string | null
  hasAttachments: boolean
  attachmentFilenames: string[]
}

interface ImportStats {
  filesListed: number
  filesProcessed: number
  documentsInserted: number
  emailsInserted: number
  duplicatesSkipped: number
  errors: number
}

async function listEmlFiles(): Promise<string[]> {
  // Query storage_objects table instead of Storage .list() API.
  // The Storage API fails on tranche subfolders with spaces/special chars.
  // Uses ilike for case-insensitive matching (.eml / .EML).
  // Filters linked_document_id IS NULL to skip already-processed files.
  const allPaths: string[] = []
  let offset = 0
  const limit = 1000

  while (true) {
    const { data, error } = await supabase
      .from('storage_objects')
      .select('path')
      .like('path', 'github/erikveland/%')
      .eq('extension', '.eml')
      .is('linked_document_id', null)
      .order('path')
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error querying storage_objects:', error)
      break
    }
    if (!data?.length) break

    allPaths.push(...data.map((r: { path: string }) => r.path))
    offset += data.length
    if (data.length < limit) break
  }

  return allPaths
}

async function downloadEml(path: string): Promise<ArrayBuffer | null> {
  const { data, error } = await supabase.storage.from('raw-archive').download(path)

  if (error) {
    console.error(`Error downloading ${path}:`, error)
    return null
  }

  return await data.arrayBuffer()
}

async function parseEml(buffer: ArrayBuffer): Promise<ParsedEmail> {
  // postal-mime is ESM-only, use dynamic import
  const { default: PostalMime } = await import('postal-mime')
  const parser = new PostalMime()
  const email = await parser.parse(buffer)

  const from = email.from
    ? (email.from.name ? `${email.from.name} <${email.from.address}>` : email.from.address || null)
    : null

  const mapAddresses = (addrs: Array<{ name?: string; address?: string }> | undefined): string[] => {
    if (!addrs) return []
    return addrs.map(a => a.name ? `${a.name} <${a.address}>` : a.address || '').filter(Boolean)
  }

  const attachments = email.attachments || []
  const attachmentFilenames = attachments
    .map(a => a.filename || '')
    .filter(Boolean)

  // Prefer text body, fall back to HTML stripped of tags
  let body = email.text || null
  if (!body && email.html) {
    body = email.html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  }

  return {
    messageId: email.messageId || null,
    subject: email.subject || null,
    from,
    to: mapAddresses(email.to),
    cc: mapAddresses(email.cc),
    bcc: mapAddresses(email.bcc),
    date: email.date || null,
    inReplyTo: email.inReplyTo || null,
    references: email.references || null,
    body,
    hasAttachments: attachments.length > 0,
    attachmentFilenames,
  }
}

function deriveThreadId(parsed: ParsedEmail): string | null {
  // Use References header first (contains the thread root), then In-Reply-To
  if (parsed.references) {
    // References is space-separated list of message-ids; first one is thread root
    const refs = parsed.references.trim().split(/\s+/)
    return refs[0] || null
  }
  if (parsed.inReplyTo) {
    return parsed.inReplyTo
  }
  return null
}

async function documentExistsByStoragePath(storagePath: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('documents')
    .select('id')
    .eq('storage_path', storagePath)
    .maybeSingle()

  if (error || !data) return null
  return data.id
}

async function insertDocument(storagePath: string, filename: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('documents')
    .insert({
      filename,
      storage_path: storagePath,
      file_type: 'eml',
      classification: 'email',
      completed_stages: COMPLETED_STAGES,
      metadata: { import_source: 'erikveland-eml' },
    })
    .select('id')
    .single()

  if (error) {
    console.error(`Error inserting document for ${filename}:`, error.message)
    return null
  }

  return data.id
}

async function insertEmail(
  documentId: string,
  parsed: ParsedEmail,
): Promise<boolean> {
  const threadId = deriveThreadId(parsed)

  const row = {
    document_id: documentId,
    message_id: parsed.messageId,
    thread_id: threadId,
    in_reply_to: parsed.inReplyTo,
    subject: parsed.subject,
    sent_date: parsed.date,
    from_raw: parsed.from,
    to_raw: parsed.to,
    cc_raw: parsed.cc,
    bcc_raw: parsed.bcc,
    body: parsed.body,
    has_attachments: parsed.hasAttachments,
    attachment_filenames: parsed.attachmentFilenames,
    confidence: 1.0,
    metadata: { source: 'erikveland-eml' },
  }

  // Plain insert — idempotency is handled by documentExistsByStoragePath check.
  // The partial unique index on message_id (WHERE NOT NULL) prevents true
  // duplicates at the DB level, but Supabase JS .upsert() doesn't support
  // partial indexes, so we use insert + catch duplicates.
  const { error } = await supabase.from('emails').insert(row)

  if (error) {
    // 23505 = unique_violation (duplicate message_id) — safe to skip
    if (error.code === '23505') return true
    console.error(`Error inserting email:`, error.message)
    return false
  }

  return true
}

async function processFile(
  storagePath: string,
  stats: ImportStats,
): Promise<void> {
  const filename = storagePath.split('/').pop() || storagePath

  // Idempotency: check if document already exists
  let documentId = await documentExistsByStoragePath(storagePath)
  if (documentId) {
    stats.duplicatesSkipped++
    return
  }

  // Download and parse
  const buffer = await downloadEml(storagePath)
  if (!buffer) {
    stats.errors++
    return
  }

  let parsed: ParsedEmail
  try {
    parsed = await parseEml(buffer)
  } catch (err) {
    console.error(`Error parsing ${filename}:`, err)
    stats.errors++
    return
  }

  // Insert document row
  documentId = await insertDocument(storagePath, filename)
  if (!documentId) {
    stats.errors++
    return
  }
  stats.documentsInserted++

  // Insert email row
  const emailOk = await insertEmail(documentId, parsed)
  if (emailOk) {
    stats.emailsInserted++
  } else {
    stats.errors++
  }
}

async function main() {
  console.log('='.repeat(60))
  console.log('Email Import: .eml files -> documents + emails tables')
  console.log('='.repeat(60))
  console.log(`  Source: raw-archive/${STORAGE_PREFIX}/`)
  console.log()

  console.log('Listing .eml files...')
  const emlFiles = await listEmlFiles()
  console.log(`Found ${emlFiles.length.toLocaleString()} .eml files`)

  if (emlFiles.length === 0) {
    console.log('No .eml files found. Exiting.')
    return
  }

  // Show sample
  console.log('Sample files:')
  for (const f of emlFiles.slice(0, 5)) {
    console.log(`  ${f}`)
  }
  if (emlFiles.length > 5) {
    console.log(`  ... and ${(emlFiles.length - 5).toLocaleString()} more`)
  }
  console.log()

  const stats: ImportStats = {
    filesListed: emlFiles.length,
    filesProcessed: 0,
    documentsInserted: 0,
    emailsInserted: 0,
    duplicatesSkipped: 0,
    errors: 0,
  }

  // Process in batches
  for (let i = 0; i < emlFiles.length; i += BATCH_SIZE) {
    const batch = emlFiles.slice(i, i + BATCH_SIZE)

    await Promise.all(batch.map(file => processFile(file, stats)))

    stats.filesProcessed += batch.length

    if (stats.filesProcessed % 500 === 0 || stats.filesProcessed >= emlFiles.length) {
      console.log(
        `Progress: ${stats.filesProcessed.toLocaleString()}/${emlFiles.length.toLocaleString()} ` +
        `(${stats.documentsInserted.toLocaleString()} docs, ` +
        `${stats.emailsInserted.toLocaleString()} emails, ` +
        `${stats.duplicatesSkipped.toLocaleString()} skipped, ` +
        `${stats.errors.toLocaleString()} errors)`,
      )
    }
  }

  // Summary
  console.log()
  console.log('='.repeat(60))
  console.log('SUMMARY')
  console.log('='.repeat(60))
  console.log(`  Files listed:        ${stats.filesListed.toLocaleString()}`)
  console.log(`  Files processed:     ${stats.filesProcessed.toLocaleString()}`)
  console.log(`  Documents inserted:  ${stats.documentsInserted.toLocaleString()}`)
  console.log(`  Emails inserted:     ${stats.emailsInserted.toLocaleString()}`)
  console.log(`  Duplicates skipped:  ${stats.duplicatesSkipped.toLocaleString()}`)
  console.log(`  Errors:              ${stats.errors.toLocaleString()}`)
}

main().catch(console.error)

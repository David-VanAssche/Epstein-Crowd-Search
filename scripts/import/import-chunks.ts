import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

interface ChunkInsert {
  document_id: string
  chunk_index: number
  content: string
  char_count: number
  token_count_estimate: number
  metadata: Record<string, unknown>
  embedding_model: null
  source: 'benbaessler' | 'svetfm'
}

interface SourceStats {
  source: string
  filesProcessed: number
  chunksInserted: number
  chunksSkipped: number
  documentsMatched: number
  errors: number
}

async function listStorageFiles(path: string): Promise<string[]> {
  const { data, error } = await supabase.storage.from('raw-archive').list(path, {
    limit: 100000,
    sortBy: { column: 'name', order: 'asc' },
  })

  if (error) {
    console.error(`Error listing files in ${path}:`, error)
    return []
  }

  return data?.map(f => f.name).filter(n => !n.startsWith('.')) || []
}

async function downloadText(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from('raw-archive').download(path)

  if (error) {
    console.error(`Error downloading ${path}:`, error)
    return null
  }

  return await data.text()
}

async function findDocumentByStoragePath(pattern: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('documents')
    .select('id')
    .ilike('storage_path', `%${pattern}%`)
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  return data.id
}

async function findDocumentByOriginalPath(efta: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('documents')
    .select('id')
    .or(`original_path.ilike.%${efta}%,metadata->>efta_start.eq.${efta}`)
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  return data.id
}

async function matchDocument(filename: string): Promise<string | null> {
  // Extract EFTA number from filename
  const eftaMatch = filename.match(/EFTA(\d{8})/i)
  if (eftaMatch) {
    const docId = await findDocumentByOriginalPath(`EFTA${eftaMatch[1]}`)
    if (docId) return docId
  }

  // Try filename without extension
  const basename = filename.replace(/\.[^.]+$/, '')
  return await findDocumentByStoragePath(basename)
}

async function insertChunksBatch(chunks: ChunkInsert[]): Promise<number> {
  if (chunks.length === 0) return 0

  const { error } = await supabase
    .from('chunks')
    .upsert(chunks, { onConflict: 'document_id,chunk_index' })

  if (error) {
    console.error(`Error inserting chunks batch (${chunks.length} chunks):`, error.message)
    // Retry once before giving up
    const { error: retryError } = await supabase
      .from('chunks')
      .upsert(chunks, { onConflict: 'document_id,chunk_index' })
    if (retryError) {
      console.error(`  Retry also failed: ${retryError.message}`)
      return 0
    }
  }

  return chunks.length
}

async function updateDocumentStage(documentId: string): Promise<void> {
  const { data: doc } = await supabase
    .from('documents')
    .select('completed_stages')
    .eq('id', documentId)
    .single()

  if (!doc) return

  const stages = (doc.completed_stages as string[]) || []
  if (!stages.includes('chunk')) {
    await supabase
      .from('documents')
      .update({ completed_stages: [...stages, 'chunk'] })
      .eq('id', documentId)
  }
}

async function processBenbaessler(): Promise<SourceStats> {
  const stats: SourceStats = {
    source: 'benbaessler',
    filesProcessed: 0,
    chunksInserted: 0,
    chunksSkipped: 0,
    documentsMatched: 0,
    errors: 0,
  }

  console.log('\n=== Processing benbaessler ===')

  const files = await listStorageFiles('github/benbaessler')
  console.log(`Found ${files.length} files`)

  let batch: ChunkInsert[] = []
  const matchedDocs = new Set<string>()

  for (const filename of files) {
    if (!filename.endsWith('.txt')) continue

    stats.filesProcessed++

    const content = await downloadText(`github/benbaessler/${filename}`)
    if (!content) {
      stats.errors++
      continue
    }

    const documentId = await matchDocument(filename)

    if (!documentId) {
      stats.chunksSkipped++
      continue
    }

    matchedDocs.add(documentId)

    const chunk: ChunkInsert = {
      document_id: documentId,
      chunk_index: 0,
      content: content.trim(),
      char_count: content.length,
      token_count_estimate: Math.ceil(content.length / 4),
      metadata: { original_filename: filename },
      embedding_model: null,
      source: 'benbaessler',
    }

    batch.push(chunk)

    if (batch.length >= 500) {
      const inserted = await insertChunksBatch(batch)
      stats.chunksInserted += inserted
      batch = []
    }

    if (stats.filesProcessed % 500 === 0) {
      console.log(`Processed ${stats.filesProcessed} files, ${stats.chunksInserted} chunks inserted, ${stats.chunksSkipped} skipped`)
    }
  }

  if (batch.length > 0) {
    const inserted = await insertChunksBatch(batch)
    stats.chunksInserted += inserted
  }

  stats.documentsMatched = matchedDocs.size

  console.log('Updating document stages...')
  for (const docId of matchedDocs) {
    await updateDocumentStage(docId)
  }

  return stats
}

async function processSvetfm(path: string): Promise<SourceStats> {
  const stats: SourceStats = {
    source: `svetfm (${path})`,
    filesProcessed: 0,
    chunksInserted: 0,
    chunksSkipped: 0,
    documentsMatched: 0,
    errors: 0,
  }

  console.log(`\n=== Processing ${path} ===`)

  const files = await listStorageFiles(path)
  console.log(`Found ${files.length} files`)

  let batch: ChunkInsert[] = []
  const matchedDocs = new Set<string>()

  for (const filename of files) {
    if (filename.endsWith('.parquet')) {
      console.warn(`Skipping parquet file ${filename} — install parquet-wasm to process`)
      continue
    }

    if (!filename.endsWith('.json') && !filename.endsWith('.jsonl')) continue

    stats.filesProcessed++

    const text = await downloadText(`${path}/${filename}`)
    if (!text) {
      stats.errors++
      continue
    }

    // Parse JSONL or JSON array
    const lines = text.trim().split('\n')
    let records: Record<string, unknown>[] = []

    if (lines.length > 1 && lines[0].trim().startsWith('{')) {
      // JSONL format
      for (const line of lines) {
        if (!line.trim()) continue
        try { records.push(JSON.parse(line)) } catch { /* skip */ }
      }
    } else {
      try {
        const parsed = JSON.parse(text)
        records = Array.isArray(parsed) ? parsed : [parsed]
      } catch {
        stats.errors++
        continue
      }
    }

    for (let i = 0; i < records.length; i++) {
      const record = records[i]

      // Extract text content
      const content = (record.text || record.content || record.chunk || record.page_content) as string
      if (!content || typeof content !== 'string') {
        stats.chunksSkipped++
        continue
      }

      // Try to find document reference
      const docRef = (record.document_id || record.doc_id || record.efta || record.source) as string
      let documentId: string | null = null

      if (docRef && typeof docRef === 'string') {
        documentId = await matchDocument(docRef)
      }

      if (!documentId && record.metadata) {
        const meta = record.metadata as Record<string, unknown>
        const metaRef = (meta.document_id || meta.efta || meta.source) as string
        if (metaRef) documentId = await matchDocument(String(metaRef))
      }

      if (!documentId) {
        stats.chunksSkipped++
        continue
      }

      matchedDocs.add(documentId)

      const chunk: ChunkInsert = {
        document_id: documentId,
        chunk_index: (record.chunk_index as number) ?? i,
        content: content.trim(),
        char_count: content.length,
        token_count_estimate: Math.ceil(content.length / 4),
        metadata: { original_filename: filename, original_index: i },
        embedding_model: null,
        source: 'svetfm',
      }

      batch.push(chunk)

      if (batch.length >= 500) {
        const inserted = await insertChunksBatch(batch)
        stats.chunksInserted += inserted
        batch = []
      }
    }

    console.log(`Processed ${filename}: ${records.length} records`)
  }

  if (batch.length > 0) {
    const inserted = await insertChunksBatch(batch)
    stats.chunksInserted += inserted
  }

  stats.documentsMatched = matchedDocs.size

  console.log('Updating document stages...')
  for (const docId of matchedDocs) {
    await updateDocumentStage(docId)
  }

  return stats
}

async function main() {
  console.log('Starting chunk import from community sources...\n')

  const allStats: SourceStats[] = []

  try {
    allStats.push(await processBenbaessler())
  } catch (err) {
    console.error('Error processing benbaessler:', err)
  }

  try {
    allStats.push(await processSvetfm('huggingface/svetfm-fbi'))
  } catch (err) {
    console.error('Error processing svetfm-fbi:', err)
  }

  try {
    allStats.push(await processSvetfm('huggingface/svetfm-nov11'))
  } catch (err) {
    console.error('Error processing svetfm-nov11:', err)
  }

  // Print summary
  console.log('\n=== IMPORT SUMMARY ===')
  for (const stats of allStats) {
    console.log(`\n${stats.source}:`)
    console.log(`  Files processed: ${stats.filesProcessed}`)
    console.log(`  Chunks inserted: ${stats.chunksInserted}`)
    console.log(`  Chunks skipped: ${stats.chunksSkipped}`)
    console.log(`  Documents matched: ${stats.documentsMatched}`)
    console.log(`  Errors: ${stats.errors}`)
  }

  const totalInserted = allStats.reduce((sum, s) => sum + s.chunksInserted, 0)
  const totalSkipped = allStats.reduce((sum, s) => sum + s.chunksSkipped, 0)
  const totalDocs = allStats.reduce((sum, s) => sum + s.documentsMatched, 0)

  console.log(`\nTOTAL: ${totalInserted} chunks inserted, ${totalSkipped} skipped, ${totalDocs} documents updated`)
}

main().catch(console.error)

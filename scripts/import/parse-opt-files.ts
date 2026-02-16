// scripts/import/parse-opt-files.ts
// Parse OPT (Opticon) load files from each DOJ dataset to seed the documents table.
//
// OPT line format: BatesNumber,VolumeLabel,ImageFilePath,DocumentBreak,,,PageCount
// DocumentBreak=Y marks the first page of a new logical document.
//
// Storage structure varies by dataset:
//   Most:  doj/dataset-{N}/VOL0000{N}/DATA/*.OPT, images at VOL0000{N}/IMAGES/
//   DS6:   doj/dataset-6/DataSet6/VOL00006/DATA/*.OPT
//   DS9:   doj/dataset-9/DataSet_9/DATA/*.OPT, images at DataSet_9/VOL00009/IMAGES/

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// --- Types ---

interface OPTLine {
  batesNumber: string
  volumeLabel: string
  imageFilePath: string
  documentBreak: boolean
  pageCount: number
}

interface DocumentInsert {
  dataset_id: string
  filename: string
  original_path: string
  storage_path: string
  file_type: string
  mime_type: string
  page_count: number
  processing_status: string
  metadata: Record<string, unknown>
}

// --- Config ---

// Hardcoded OPT paths discovered via storage inspection.
// Each entry: [optFilePath, volumeBaseForImages]
const DATASET_PATHS: Record<number, { opt: string; volumeBase: string }> = {
  1:  { opt: 'doj/dataset-1/VOL00001/DATA/VOL00001.OPT', volumeBase: 'doj/dataset-1/VOL00001' },
  2:  { opt: 'doj/dataset-2/VOL00002/DATA/VOL00002.OPT', volumeBase: 'doj/dataset-2/VOL00002' },
  3:  { opt: 'doj/dataset-3/VOL00003/DATA/VOL00003.OPT', volumeBase: 'doj/dataset-3/VOL00003' },
  4:  { opt: 'doj/dataset-4/VOL00004/DATA/VOL00004.OPT', volumeBase: 'doj/dataset-4/VOL00004' },
  5:  { opt: 'doj/dataset-5/VOL00005/DATA/VOL00005.OPT', volumeBase: 'doj/dataset-5/VOL00005' },
  6:  { opt: 'doj/dataset-6/DataSet6/VOL00006/DATA/VOL00006.OPT', volumeBase: 'doj/dataset-6/DataSet6/VOL00006' },
  7:  { opt: 'doj/dataset-7/VOL00007/DATA/VOL00007.OPT', volumeBase: 'doj/dataset-7/VOL00007' },
  8:  { opt: 'doj/dataset-8/VOL00008/DATA/VOL00008.OPT', volumeBase: 'doj/dataset-8/VOL00008' },
  9:  { opt: 'doj/dataset-9/DataSet_9/DATA/VOL00009.OPT', volumeBase: 'doj/dataset-9/DataSet_9/VOL00009' },
  10: { opt: 'doj/dataset-10/VOL00010/DATA/VOL00010.OPT', volumeBase: 'doj/dataset-10/VOL00010' },
  11: { opt: 'doj/dataset-11/VOL00011/DATA/VOL00011.OPT', volumeBase: 'doj/dataset-11/VOL00011' },
  12: { opt: 'doj/dataset-12/VOL00012/DATA/VOL00012.OPT', volumeBase: 'doj/dataset-12/VOL00012' },
}

const MIME_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  avi: 'video/x-msvideo',
  mp4: 'video/mp4',
  m4v: 'video/x-m4v',
}

const BATCH_SIZE = 500

// --- Helpers ---

function parseOPTLine(line: string): OPTLine | null {
  const trimmed = line.trim()
  if (!trimmed) return null

  // CSV-aware parse (handles quoted fields)
  const parts: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      parts.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  parts.push(current)

  if (parts.length < 4) return null

  return {
    batesNumber: parts[0],
    volumeLabel: parts[1],
    imageFilePath: parts[2].replace(/\\/g, '/'),
    documentBreak: parts[3] === 'Y',
    pageCount: parseInt(parts[6] || parts[5] || '1', 10) || 1,
  }
}

function getFileExtension(filename: string): string {
  const parts = filename.split('.')
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : ''
}

function getMimeType(filename: string): string {
  const ext = getFileExtension(filename)
  return MIME_TYPES[ext] || 'application/octet-stream'
}

function getBasename(path: string): string {
  const parts = path.split('/')
  return parts[parts.length - 1]
}

// --- Core logic ---

function buildDocuments(
  lines: OPTLine[],
  datasetNumber: number,
  datasetId: string,
  volumeBase: string,
): DocumentInsert[] {
  const documents: DocumentInsert[] = []
  let currentPages: OPTLine[] = []

  for (const line of lines) {
    if (line.documentBreak && currentPages.length > 0) {
      // Flush previous document
      const doc = createDocument(currentPages, datasetNumber, datasetId, volumeBase)
      if (doc) documents.push(doc)
      currentPages = []
    }
    currentPages.push(line)
  }

  // Flush last document
  if (currentPages.length > 0) {
    const doc = createDocument(currentPages, datasetNumber, datasetId, volumeBase)
    if (doc) documents.push(doc)
  }

  return documents
}

function createDocument(
  pages: OPTLine[],
  datasetNumber: number,
  datasetId: string,
  volumeBase: string,
): DocumentInsert | null {
  if (pages.length === 0) return null

  const first = pages[0]
  const last = pages[pages.length - 1]

  const filename = getBasename(first.imageFilePath)
  // Storage path: volumeBase + relative image path from OPT
  const storagePath = `${volumeBase}/${first.imageFilePath}`

  return {
    dataset_id: datasetId,
    filename,
    original_path: pages.length === 1
      ? first.batesNumber
      : `${first.batesNumber}-${last.batesNumber}`,
    storage_path: storagePath,
    file_type: getFileExtension(filename),
    mime_type: getMimeType(filename),
    page_count: pages.length,
    processing_status: 'pending',
    metadata: {
      efta_start: first.batesNumber,
      efta_end: last.batesNumber,
      volume_label: first.volumeLabel,
    },
  }
}

// --- Database operations ---

async function getDatasetUUID(datasetNumber: number): Promise<string | null> {
  const { data, error } = await supabase
    .from('datasets')
    .select('id')
    .eq('dataset_number', datasetNumber)
    .single()

  if (error) {
    console.error(`  Error fetching dataset ${datasetNumber}:`, error.message)
    return null
  }
  return data?.id || null
}

async function batchInsert(documents: DocumentInsert[], datasetNumber: number): Promise<number> {
  let inserted = 0

  for (let i = 0; i < documents.length; i += BATCH_SIZE) {
    const batch = documents.slice(i, i + BATCH_SIZE)

    const { error } = await supabase.from('documents').insert(batch)

    if (error) {
      console.error(`  Batch ${Math.floor(i / BATCH_SIZE) + 1} failed: ${error.message}`)
      // Try individual inserts for this batch to find the bad row
      for (const doc of batch) {
        const { error: singleErr } = await supabase.from('documents').insert(doc)
        if (!singleErr) inserted++
      }
      continue
    }

    inserted += batch.length
    if (inserted % 5000 === 0 || i + BATCH_SIZE >= documents.length) {
      console.log(`  DS${datasetNumber}: ${inserted.toLocaleString()}/${documents.length.toLocaleString()} documents...`)
    }
  }

  return inserted
}

// --- Main ---

async function processDataset(datasetNumber: number): Promise<number> {
  const paths = DATASET_PATHS[datasetNumber]
  if (!paths) {
    console.error(`DS${datasetNumber}: No path configuration`)
    return 0
  }

  console.log(`\n--- DS${datasetNumber} ---`)

  // Get dataset UUID
  const datasetId = await getDatasetUUID(datasetNumber)
  if (!datasetId) {
    console.error(`  Not found in datasets table. Run seed-datasets.ts first.`)
    return 0
  }

  // Idempotency check
  const { count, error: countErr } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true })
    .eq('dataset_id', datasetId)

  if (countErr) {
    console.error(`  Count check failed: ${countErr.message}`)
    return 0
  }

  if (count && count > 0) {
    console.log(`  Already has ${count.toLocaleString()} documents. Skipping.`)
    return count
  }

  // Download OPT file
  console.log(`  Downloading ${paths.opt}...`)
  const { data, error } = await supabase.storage.from('raw-archive').download(paths.opt)
  if (error || !data) {
    console.error(`  Download failed: ${error?.message}`)
    return 0
  }

  const text = await data.text()
  const rawLines = text.split('\n')
  console.log(`  OPT file: ${rawLines.length.toLocaleString()} lines`)

  // Parse all lines
  const parsed: OPTLine[] = []
  let parseErrors = 0
  for (const line of rawLines) {
    const p = parseOPTLine(line)
    if (p) {
      parsed.push(p)
    } else if (line.trim()) {
      parseErrors++
    }
  }
  if (parseErrors > 0) {
    console.log(`  ${parseErrors} unparseable lines (skipped)`)
  }

  // Build documents
  const documents = buildDocuments(parsed, datasetNumber, datasetId, paths.volumeBase)
  console.log(`  ${documents.length.toLocaleString()} documents from ${parsed.length.toLocaleString()} pages`)

  // Insert
  const inserted = await batchInsert(documents, datasetNumber)
  console.log(`  Inserted: ${inserted.toLocaleString()} documents`)

  return inserted
}

async function main() {
  console.log('=== OPT File Parser & Document Seeder ===')
  console.log('Parsing Opticon load files from all 12 DOJ datasets.\n')

  let totalDocs = 0
  let totalPages = 0

  for (let i = 1; i <= 12; i++) {
    const count = await processDataset(i)
    totalDocs += count
  }

  // Verify total
  const { count: dbCount } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true })

  const { data: pageSum } = await supabase.rpc('corpus_totals')
  if (pageSum && (pageSum as any[])[0]) {
    totalPages = (pageSum as any[])[0].total_pages
  }

  console.log(`\n=== COMPLETE ===`)
  console.log(`Documents in database: ${(dbCount || 0).toLocaleString()}`)
  console.log(`Total pages: ${totalPages.toLocaleString()}`)
}

main().catch(console.error)

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

interface OPTLine {
  batesNumber: string
  volumeLabel: string
  imageFilePath: string
  documentBreak: string
  folderBreak: string
  pageCount: string
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
  metadata: {
    efta_start: string
    efta_end: string
    volume_label?: string
    needs_opt_mapping?: boolean
  }
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
const DATASETS_WITH_OPT = [1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12]

async function getDatasetUUID(datasetNumber: number): Promise<string | null> {
  const { data, error } = await supabase
    .from('datasets')
    .select('id')
    .eq('dataset_number', datasetNumber)
    .single()

  if (error) {
    console.error(`Error fetching dataset ${datasetNumber}:`, error)
    return null
  }

  return data?.id || null
}

async function findOPTFile(datasetNumber: number): Promise<string | null> {
  const prefix = `doj/dataset-${datasetNumber}/DATA`

  const { data, error } = await supabase.storage
    .from('raw-archive')
    .list(prefix, { limit: 1000 })

  if (error) {
    console.error(`Error listing DATA folder for dataset ${datasetNumber}:`, error)
    return null
  }

  if (!data || data.length === 0) return null

  const optFile = data.find(f => f.name.toUpperCase().endsWith('.OPT'))
  return optFile ? `${prefix}/${optFile.name}` : null
}

async function downloadOPTFile(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('raw-archive')
    .download(path)

  if (error) {
    console.error(`Error downloading ${path}:`, error)
    return null
  }

  return await data.text()
}

function parseOPTLine(line: string): OPTLine | null {
  const trimmed = line.trim()
  if (!trimmed) return null

  // OPT format: BatesNumber,VolumeLabel,ImageFilePath,DocumentBreak,FolderBreak,PageCount
  // ImageFilePath may contain commas inside quotes, so we parse CSV-aware
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
    imageFilePath: parts[2],
    documentBreak: parts[3] || '',
    folderBreak: parts[4] || '',
    pageCount: parts[5] || '1',
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
  const normalized = path.replace(/\\/g, '/')
  const parts = normalized.split('/')
  return parts[parts.length - 1]
}

function normalizeImagePath(path: string): string {
  return path.replace(/\\/g, '/')
}

function createDocumentFromPages(
  pages: OPTLine[],
  datasetNumber: number,
  datasetId: string
): DocumentInsert | null {
  if (pages.length === 0) return null

  const firstPage = pages[0]
  const lastPage = pages[pages.length - 1]

  const imagePath = normalizeImagePath(firstPage.imageFilePath)
  const filename = getBasename(imagePath)
  const storagePath = `doj/dataset-${datasetNumber}/${imagePath}`

  return {
    dataset_id: datasetId,
    filename,
    original_path: pages.length === 1
      ? firstPage.batesNumber
      : `${firstPage.batesNumber}-${lastPage.batesNumber}`,
    storage_path: storagePath,
    file_type: getFileExtension(filename),
    mime_type: getMimeType(filename),
    page_count: pages.length,
    processing_status: 'pending',
    metadata: {
      efta_start: firstPage.batesNumber,
      efta_end: lastPage.batesNumber,
      volume_label: firstPage.volumeLabel,
    },
  }
}

async function processOPTDataset(datasetNumber: number, datasetId: string): Promise<number> {
  console.log(`\n=== Processing Dataset ${datasetNumber} ===`)

  // Check if already seeded
  const { count, error: countError } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true })
    .eq('dataset_id', datasetId)

  if (countError) {
    console.error(`Error checking existing documents:`, countError)
    return 0
  }

  if (count && count > 0) {
    console.log(`Dataset ${datasetNumber} already has ${count} documents. Skipping.`)
    return count
  }

  // Find OPT file
  const optPath = await findOPTFile(datasetNumber)
  if (!optPath) {
    console.error(`No OPT file found for dataset ${datasetNumber}`)
    return 0
  }

  console.log(`Found OPT file: ${optPath}`)

  // Download OPT file
  const optContent = await downloadOPTFile(optPath)
  if (!optContent) {
    console.error(`Failed to download OPT file`)
    return 0
  }

  const lines = optContent.split('\n')
  console.log(`OPT file has ${lines.length} lines`)

  // Parse and group documents
  const documents: DocumentInsert[] = []
  let currentDoc: OPTLine[] = []
  let totalPages = 0

  for (const line of lines) {
    const parsed = parseOPTLine(line)
    if (!parsed) continue

    totalPages++

    if (parsed.documentBreak === 'Y' && currentDoc.length > 0) {
      // Save previous document
      const doc = createDocumentFromPages(currentDoc, datasetNumber, datasetId)
      if (doc) documents.push(doc)
      currentDoc = []
    }

    currentDoc.push(parsed)
  }

  // Don't forget the last document
  if (currentDoc.length > 0) {
    const doc = createDocumentFromPages(currentDoc, datasetNumber, datasetId)
    if (doc) documents.push(doc)
  }

  console.log(`Parsed ${documents.length} documents from ${totalPages} pages`)

  // Batch insert
  return await batchInsertDocuments(documents, datasetNumber)
}

async function processDS9(datasetId: string): Promise<number> {
  console.log(`\n=== Processing Dataset 9 (no OPT, file enumeration) ===`)

  // Check if already seeded
  const { count, error: countError } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true })
    .eq('dataset_id', datasetId)

  if (countError) {
    console.error(`Error checking existing documents:`, countError)
    return 0
  }

  if (count && count > 0) {
    console.log(`Dataset 9 already has ${count} documents. Skipping.`)
    return count
  }

  // DS9 has nested subdirectories under IMAGES/
  // First list top-level subdirs, then list files in each
  const documents: DocumentInsert[] = []
  const topDirs = await listDir('doj/dataset-9/IMAGES')

  for (const dir of topDirs) {
    if (!dir.name || dir.name.startsWith('.')) continue

    const subPath = `doj/dataset-9/IMAGES/${dir.name}`
    let offset = 0

    while (true) {
      const { data, error } = await supabase.storage
        .from('raw-archive')
        .list(subPath, { limit: 1000, offset })

      if (error || !data || data.length === 0) break

      for (const file of data) {
        if (!file.name || !file.name.includes('.')) continue

        const filename = file.name
        const storagePath = `${subPath}/${filename}`

        documents.push({
          dataset_id: datasetId,
          filename,
          original_path: filename.replace(/\.[^.]+$/, ''),
          storage_path: storagePath,
          file_type: getFileExtension(filename),
          mime_type: getMimeType(filename),
          page_count: 1,
          processing_status: 'pending',
          metadata: {
            efta_start: filename.replace(/\.[^.]+$/, ''),
            efta_end: filename.replace(/\.[^.]+$/, ''),
            needs_opt_mapping: true,
          },
        })
      }

      if (data.length < 1000) break
      offset += 1000
    }

    if (documents.length % 10000 === 0) {
      console.log(`Enumerated ${documents.length} files so far...`)
    }
  }

  console.log(`Found ${documents.length} files in DS9`)
  return await batchInsertDocuments(documents, 9)
}

async function listDir(path: string) {
  const { data, error } = await supabase.storage
    .from('raw-archive')
    .list(path, { limit: 10000 })

  if (error) {
    console.error(`Error listing ${path}:`, error)
    return []
  }
  return data || []
}

async function batchInsertDocuments(documents: DocumentInsert[], datasetNumber: number): Promise<number> {
  let inserted = 0
  const failedBatches: { index: number; batch: DocumentInsert[] }[] = []

  for (let i = 0; i < documents.length; i += BATCH_SIZE) {
    const batch = documents.slice(i, i + BATCH_SIZE)

    const { error } = await supabase
      .from('documents')
      .insert(batch)

    if (error) {
      console.error(`Error inserting batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error.message)
      failedBatches.push({ index: i, batch })
      continue
    }

    inserted += batch.length
    if (inserted % 5000 === 0 || i + BATCH_SIZE >= documents.length) {
      console.log(`Dataset ${datasetNumber}: Inserted ${inserted}/${documents.length} documents...`)
    }
  }

  // Retry failed batches once
  if (failedBatches.length > 0) {
    console.log(`Retrying ${failedBatches.length} failed batches...`)
    for (const { batch } of failedBatches) {
      const { error } = await supabase.from('documents').insert(batch)
      if (!error) {
        inserted += batch.length
        console.log(`  Retry succeeded (${batch.length} docs)`)
      } else {
        console.error(`  Retry failed: ${error.message}`)
      }
    }
  }

  console.log(`Dataset ${datasetNumber}: Inserted ${inserted} documents total`)
  return inserted
}

async function main() {
  console.log('=== OPT File Parser & Document Seeder ===\n')

  let totalDocuments = 0

  // Process datasets 1-8, 10-12 (with OPT files)
  for (const datasetNumber of DATASETS_WITH_OPT) {
    const datasetId = await getDatasetUUID(datasetNumber)

    if (!datasetId) {
      console.error(`Dataset ${datasetNumber} not found in database. Run seed-datasets.ts first.`)
      continue
    }

    const count = await processOPTDataset(datasetNumber, datasetId)
    totalDocuments += count
  }

  // Process DS9 separately (no OPT file)
  const ds9Id = await getDatasetUUID(9)
  if (ds9Id) {
    const count = await processDS9(ds9Id)
    totalDocuments += count
  } else {
    console.error('Dataset 9 not found. Run seed-datasets.ts first.')
  }

  console.log(`\n=== COMPLETE ===`)
  console.log(`Total documents in database: ${totalDocuments.toLocaleString()}`)
}

main().catch(console.error)

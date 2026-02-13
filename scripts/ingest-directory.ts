// scripts/ingest-directory.ts
// Ingest a local directory of files into the processing pipeline.
// Usage: npx tsx scripts/ingest-directory.ts ./data/raw/dataset-1/ --dataset-id <uuid>

import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

async function main() {
  const dir = process.argv[2]
  const datasetIdFlag = process.argv.indexOf('--dataset-id')
  const datasetId = datasetIdFlag !== -1 ? process.argv[datasetIdFlag + 1] : null

  if (!dir) {
    console.error('Usage: npx tsx scripts/ingest-directory.ts <directory> [--dataset-id <uuid>]')
    process.exit(1)
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  // Walk directory and find all processable files
  const files: string[] = []
  const EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.tiff', '.doc', '.docx']

  function walk(d: string) {
    const entries = fs.readdirSync(d, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(d, entry.name)
      if (entry.isDirectory()) walk(fullPath)
      else if (EXTENSIONS.includes(path.extname(entry.name).toLowerCase())) {
        files.push(fullPath)
      }
    }
  }

  walk(dir)
  console.log(`Found ${files.length} files to ingest`)

  let ingested = 0
  for (const filePath of files) {
    const filename = path.basename(filePath)
    const ext = path.extname(filename).toLowerCase()
    const mimeTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.tiff': 'image/tiff',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    }

    try {
      // Upload to Supabase Storage
      const fileBuffer = fs.readFileSync(filePath)
      const storagePath = `uploads/${datasetId || 'unassigned'}/${filename}`

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(storagePath, fileBuffer, {
          contentType: mimeTypes[ext] || 'application/octet-stream',
          upsert: true,
        })

      if (uploadError) {
        console.warn(`Failed to upload ${filename}: ${uploadError.message}`)
        continue
      }

      // Create document record
      const { error: insertError } = await supabase
        .from('documents')
        .insert({
          dataset_id: datasetId,
          filename,
          original_path: filePath,
          storage_path: storagePath,
          file_type: ext.replace('.', ''),
          mime_type: mimeTypes[ext],
          file_size_bytes: fileBuffer.length,
          processing_status: 'pending',
        })
        .select('id')
        .single()

      if (insertError) {
        console.warn(`Failed to insert document record for ${filename}: ${insertError.message}`)
        continue
      }

      ingested++
      if (ingested % 100 === 0) {
        console.log(`Ingested ${ingested}/${files.length} files...`)
      }
    } catch (err) {
      console.warn(`Error ingesting ${filename}:`, err)
    }
  }

  console.log(`\nIngestion complete: ${ingested}/${files.length} files uploaded (run batch scripts to process)`)
}

main().catch(console.error)

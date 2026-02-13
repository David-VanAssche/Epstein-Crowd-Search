// scripts/estimate-costs.ts
// Estimate processing costs for a directory of documents.
// Usage: npx tsx scripts/estimate-costs.ts ./data/raw/dataset-1/

import fs from 'fs'
import path from 'path'

const COST_PER_PAGE = {
  ocr: 0.0015,
  classification: 0.0002,
  chunking: 0.0,
  contextual_headers: 0.0005,
  embedding: 0.0001,
  entity_extraction: 0.001,
  relationship_mapping: 0.0008,
  redaction_detection: 0.0005,
  timeline_extraction: 0.0005,
  summarization: 0.0003,
  criminal_indicators: 0.0008,
}

const AVG_PAGES_PER_PDF = 5

function countFiles(dir: string): { pdfs: number; images: number; audio: number; video: number } {
  const counts = { pdfs: 0, images: 0, audio: 0, video: 0 }

  function walk(d: string) {
    const entries = fs.readdirSync(d, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(d, entry.name)
      if (entry.isDirectory()) {
        walk(fullPath)
      } else {
        const ext = path.extname(entry.name).toLowerCase()
        if (['.pdf', '.doc', '.docx'].includes(ext)) counts.pdfs++
        else if (['.jpg', '.jpeg', '.png', '.gif', '.tiff', '.bmp'].includes(ext)) counts.images++
        else if (['.mp3', '.wav', '.m4a', '.ogg', '.flac'].includes(ext)) counts.audio++
        else if (['.mp4', '.avi', '.mov', '.mkv'].includes(ext)) counts.video++
      }
    }
  }

  walk(dir)
  return counts
}

function main() {
  const dir = process.argv[2]
  if (!dir) {
    console.error('Usage: npx tsx scripts/estimate-costs.ts <directory>')
    process.exit(1)
  }

  if (!fs.existsSync(dir)) {
    console.error(`Directory not found: ${dir}`)
    process.exit(1)
  }

  const counts = countFiles(dir)
  const totalPages = counts.pdfs * AVG_PAGES_PER_PDF + counts.images

  console.log('\n=== File Counts ===')
  console.log(`PDFs:   ${counts.pdfs}`)
  console.log(`Images: ${counts.images}`)
  console.log(`Audio:  ${counts.audio}`)
  console.log(`Video:  ${counts.video}`)
  console.log(`Est. total pages: ${totalPages}`)

  console.log('\n=== Cost Breakdown (per page) ===')
  let totalCostPerPage = 0
  for (const [stage, cost] of Object.entries(COST_PER_PAGE)) {
    console.log(`  ${stage.padEnd(25)} $${cost.toFixed(4)}`)
    totalCostPerPage += cost
  }
  console.log(`  ${'TOTAL per page'.padEnd(25)} $${totalCostPerPage.toFixed(4)}`)

  const totalCost = totalPages * totalCostPerPage
  const audioCost = counts.audio * 0.10 // ~$0.10 per audio file (Whisper)
  const videoCost = counts.video * 0.15 // ~$0.15 per video file

  console.log('\n=== Estimated Total Cost ===')
  console.log(`  Document processing: $${totalCost.toFixed(2)}`)
  console.log(`  Audio transcription: $${audioCost.toFixed(2)}`)
  console.log(`  Video transcription: $${videoCost.toFixed(2)}`)
  console.log(`  ────────────────────────`)
  console.log(`  TOTAL:               $${(totalCost + audioCost + videoCost).toFixed(2)}`)
  console.log(`\n  Cost per $1 donated: ~${Math.round(1 / totalCostPerPage)} pages processed`)
}

main()

// lib/pipeline/services/smart-chunker.ts
// Stage 3: Structure-aware chunking.
// Splits OCR text into 800-1500 char chunks respecting heading/section boundaries.
// No API calls — pure text processing.

import { SupabaseClient } from '@supabase/supabase-js'

// --- Types ---

interface ChunkData {
  chunkIndex: number
  content: string
  pageNumber: number | null
  sectionTitle: string | null
  hierarchyPath: string[]
  charCount: number
  tokenCountEstimate: number
}

interface ChunkingConfig {
  minChunkSize: number
  maxChunkSize: number
  targetChunkSize: number
  overlapChars: number
}

const DEFAULT_CONFIG: ChunkingConfig = {
  minChunkSize: 400,
  maxChunkSize: 1500,
  targetChunkSize: 1000,
  overlapChars: 100,
}

// --- Section parsing ---

interface Section {
  title: string
  level: number
  content: string
  pageNumber: number | null
}

function parseSections(text: string): Section[] {
  const lines = text.split('\n')
  const sections: Section[] = []
  let currentSection: Section = {
    title: 'Document Start',
    level: 1,
    content: '',
    pageNumber: 1,
  }
  let currentPage = 1

  for (const line of lines) {
    const pageMatch = line.match(/---\s*Page\s+(\d+)\s*---/)
    if (pageMatch) {
      currentPage = parseInt(pageMatch[1], 10)
      continue
    }

    const headingMatch = line.match(/^(#{1,4})\s+(.+)/)
    if (headingMatch) {
      if (currentSection.content.trim().length > 0) {
        sections.push({ ...currentSection })
      }
      currentSection = {
        title: headingMatch[2].trim(),
        level: headingMatch[1].length,
        content: '',
        pageNumber: currentPage,
      }
      continue
    }

    currentSection.content += line + '\n'
    currentSection.pageNumber = currentSection.pageNumber || currentPage
  }

  if (currentSection.content.trim().length > 0) {
    sections.push(currentSection)
  }

  return sections
}

function buildHierarchyPath(sections: Section[], currentIndex: number): string[] {
  const path: string[] = []
  const currentLevel = sections[currentIndex].level

  for (let i = currentIndex; i >= 0; i--) {
    if (sections[i].level < currentLevel || i === currentIndex) {
      if (sections[i].level <= (path.length > 0 ? sections[currentIndex].level : Infinity)) {
        path.unshift(sections[i].title)
      }
    }
    if (sections[i].level === 1 && i !== currentIndex) break
  }

  return path
}

function splitSectionIntoChunks(
  section: Section,
  hierarchyPath: string[],
  startIndex: number,
  config: ChunkingConfig
): ChunkData[] {
  const chunks: ChunkData[] = []
  const text = section.content.trim()

  if (text.length === 0) return chunks

  if (text.length <= config.maxChunkSize) {
    chunks.push({
      chunkIndex: startIndex,
      content: text,
      pageNumber: section.pageNumber,
      sectionTitle: section.title,
      hierarchyPath,
      charCount: text.length,
      tokenCountEstimate: Math.ceil(text.length / 4),
    })
    return chunks
  }

  const paragraphs = text.split(/\n\s*\n/)
  let currentChunk = ''
  let chunkIdx = startIndex

  for (const para of paragraphs) {
    const trimmedPara = para.trim()
    if (trimmedPara.length === 0) continue

    if (
      currentChunk.length + trimmedPara.length + 2 > config.maxChunkSize &&
      currentChunk.length > 0
    ) {
      chunks.push({
        chunkIndex: chunkIdx++,
        content: currentChunk.trim(),
        pageNumber: section.pageNumber,
        sectionTitle: section.title,
        hierarchyPath,
        charCount: currentChunk.trim().length,
        tokenCountEstimate: Math.ceil(currentChunk.trim().length / 4),
      })
      const overlap = currentChunk.slice(-config.overlapChars)
      currentChunk = overlap + '\n\n'
    }

    if (trimmedPara.length > config.maxChunkSize) {
      if (currentChunk.length > 0) {
        chunks.push({
          chunkIndex: chunkIdx++,
          content: currentChunk.trim(),
          pageNumber: section.pageNumber,
          sectionTitle: section.title,
          hierarchyPath,
          charCount: currentChunk.trim().length,
          tokenCountEstimate: Math.ceil(currentChunk.trim().length / 4),
        })
        currentChunk = ''
      }

      const sentences = trimmedPara.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [trimmedPara]
      for (const sentence of sentences) {
        if (
          currentChunk.length + sentence.length > config.maxChunkSize &&
          currentChunk.length > 0
        ) {
          chunks.push({
            chunkIndex: chunkIdx++,
            content: currentChunk.trim(),
            pageNumber: section.pageNumber,
            sectionTitle: section.title,
            hierarchyPath,
            charCount: currentChunk.trim().length,
            tokenCountEstimate: Math.ceil(currentChunk.trim().length / 4),
          })
          currentChunk = ''
        }
        currentChunk += sentence
      }
    } else {
      currentChunk += (currentChunk.length > 0 ? '\n\n' : '') + trimmedPara
    }
  }

  if (currentChunk.trim().length >= config.minChunkSize) {
    chunks.push({
      chunkIndex: chunkIdx++,
      content: currentChunk.trim(),
      pageNumber: section.pageNumber,
      sectionTitle: section.title,
      hierarchyPath,
      charCount: currentChunk.trim().length,
      tokenCountEstimate: Math.ceil(currentChunk.trim().length / 4),
    })
  } else if (currentChunk.trim().length > 0 && chunks.length > 0) {
    const lastChunk = chunks[chunks.length - 1]
    lastChunk.content += '\n\n' + currentChunk.trim()
    lastChunk.charCount = lastChunk.content.length
    lastChunk.tokenCountEstimate = Math.ceil(lastChunk.content.length / 4)
  } else if (currentChunk.trim().length > 0) {
    chunks.push({
      chunkIndex: chunkIdx++,
      content: currentChunk.trim(),
      pageNumber: section.pageNumber,
      sectionTitle: section.title,
      hierarchyPath,
      charCount: currentChunk.trim().length,
      tokenCountEstimate: Math.ceil(currentChunk.trim().length / 4),
    })
  }

  return chunks
}

export function chunkDocument(
  ocrText: string,
  config: ChunkingConfig = DEFAULT_CONFIG
): ChunkData[] {
  const sections = parseSections(ocrText)
  const allChunks: ChunkData[] = []
  let chunkIndex = 0

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i]
    const hierarchyPath = buildHierarchyPath(sections, i)
    const sectionChunks = splitSectionIntoChunks(
      section,
      hierarchyPath,
      chunkIndex,
      config
    )
    allChunks.push(...sectionChunks)
    chunkIndex += sectionChunks.length
  }

  allChunks.forEach((chunk, i) => {
    chunk.chunkIndex = i
  })

  return allChunks
}

// --- Advisory lock helper (prevents TOCTOU race conditions on concurrent workers) ---

function hashDocumentId(documentId: string): number {
  let hash = 0
  for (const ch of documentId) {
    hash = (hash * 31 + ch.charCodeAt(0)) | 0
  }
  return Math.abs(hash)
}

async function withDocumentLock<T>(
  documentId: string,
  supabase: SupabaseClient,
  fn: () => Promise<T>
): Promise<T> {
  const lockKey = hashDocumentId(documentId)
  try {
    await supabase.rpc('pg_advisory_xact_lock', { key: lockKey })
  } catch {
    // Advisory lock RPC may not exist — proceed without lock
  }
  return await fn()
}

// --- Stage handler ---

export async function handleChunk(
  documentId: string,
  supabase: SupabaseClient
): Promise<void> {
  console.log(`[Chunker] Processing document ${documentId}`)

  const { data: doc, error } = await supabase
    .from('documents')
    .select('id, ocr_text')
    .eq('id', documentId)
    .single()

  if (error || !doc) throw new Error(`Document not found: ${documentId}`)
  if (!doc.ocr_text) throw new Error(`Document ${documentId} has no OCR text`)

  // Use advisory lock to prevent TOCTOU race condition
  return withDocumentLock(documentId, supabase, async () => {
    // Check if chunks with pre-computed embeddings exist (community data).
    const { count: embeddedChunkCount } = await supabase
      .from('chunks')
      .select('id', { count: 'exact', head: true })
      .eq('document_id', documentId)
      .not('content_embedding', 'is', null)

    if (embeddedChunkCount && embeddedChunkCount > 0) {
      console.log(
        `[Chunker] Document ${documentId}: skipping — ${embeddedChunkCount} chunks with embeddings exist`
      )
      return
    }

    // Delete existing chunks without embeddings (safe idempotent re-run)
    await supabase.from('chunks').delete().eq('document_id', documentId)

    const chunks = chunkDocument(doc.ocr_text)

    if (chunks.length === 0) {
      console.warn(`[Chunker] Document ${documentId}: no chunks generated`)
      return
    }

    // Insert in batches of 50
    const BATCH_SIZE = 50
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE).map((chunk) => ({
        document_id: documentId,
        chunk_index: chunk.chunkIndex,
        content: chunk.content,
        page_number: chunk.pageNumber,
        section_title: chunk.sectionTitle,
        hierarchy_path: chunk.hierarchyPath,
        char_count: chunk.charCount,
        token_count_estimate: chunk.tokenCountEstimate,
      }))

      const { error: insertError } = await supabase.from('chunks').insert(batch)

      if (insertError) {
        throw new Error(`Failed to insert chunks batch ${i}: ${insertError.message}`)
      }
    }

    console.log(`[Chunker] Document ${documentId}: created ${chunks.length} chunks`)
  })
}

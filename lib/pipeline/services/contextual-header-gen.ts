// lib/pipeline/services/contextual-header-gen.ts
// Stage 4: Contextual Headers — Generate a 50-100 token context header per chunk.
// The header situates each chunk within the whole document, improving embedding quality
// and search relevance (Anthropic's "Contextual Retrieval" technique).

import { SupabaseClient } from '@supabase/supabase-js'

interface ChunkRow {
  id: string
  chunk_index: number
  content: string
  section_title: string | null
  hierarchy_path: string[] | null
}

async function generateContextualHeaders(
  chunks: ChunkRow[],
  documentSummary: string,
  filename: string,
  apiKey: string
): Promise<Map<string, string>> {
  const headers = new Map<string, string>()

  // Process in parallel batches of 10
  const BATCH_SIZE = 10
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE)

    const promises = batch.map(async (chunk) => {
      const hierarchyStr = chunk.hierarchy_path?.join(' > ') || ''
      const sectionStr = chunk.section_title || ''

      const prompt = `You are generating a short contextual header for a document chunk to improve search retrieval.

Document: "${filename}"
${documentSummary ? `Document summary: ${documentSummary}` : ''}
${hierarchyStr ? `Section path: ${hierarchyStr}` : ''}
${sectionStr ? `Section: ${sectionStr}` : ''}
Chunk ${chunk.chunk_index + 1} of ${chunks.length}:
---
${chunk.content.slice(0, 1000)}
---

Write a 50-100 token header that situates this chunk within the document. Include:
- What document this is from
- What section/topic this chunk covers
- Key entities mentioned (if any)

Format: A single paragraph, no bullet points. Be specific and factual.`

      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.2, maxOutputTokens: 150 },
            }),
          }
        )

        if (!response.ok) {
          console.warn(`[ContextHeaders] API error for chunk ${chunk.id}: ${response.status}`)
          return
        }

        const data = await response.json()
        const headerText = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
        if (headerText.trim()) {
          headers.set(chunk.id, headerText.trim())
        }
      } catch (err) {
        console.warn(`[ContextHeaders] Failed for chunk ${chunk.id}:`, err)
      }
    })

    await Promise.all(promises)
  }

  return headers
}

// --- Stage handler ---

export async function handleContextualHeaders(
  documentId: string,
  supabase: SupabaseClient
): Promise<void> {
  console.log(`[ContextHeaders] Processing document ${documentId}`)

  const { data: doc, error: docError } = await supabase
    .from('documents')
    .select('id, filename, ocr_text, classification, metadata')
    .eq('id', documentId)
    .single()

  if (docError || !doc) throw new Error(`Document not found: ${documentId}`)

  const docSummary = (doc.metadata as Record<string, unknown>)?.summary || ''
  const docType = doc.classification || 'unknown'
  const summaryStr = docSummary
    ? String(docSummary)
    : `${docType} document — ${(doc.ocr_text || '').slice(0, 200)}`

  const { data: chunks, error: chunkError } = await supabase
    .from('chunks')
    .select('id, chunk_index, content, section_title, hierarchy_path')
    .eq('document_id', documentId)
    .order('chunk_index', { ascending: true })

  if (chunkError || !chunks) throw new Error(`Failed to fetch chunks: ${chunkError?.message}`)
  if (chunks.length === 0) return

  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) throw new Error('GOOGLE_AI_API_KEY not set')

  const headers = await generateContextualHeaders(
    chunks as ChunkRow[],
    summaryStr,
    doc.filename,
    apiKey
  )

  let updatedCount = 0
  for (const [chunkId, headerText] of headers) {
    const { error: updateError } = await supabase
      .from('chunks')
      .update({ contextual_header: headerText })
      .eq('id', chunkId)

    if (!updateError) updatedCount++
  }

  console.log(
    `[ContextHeaders] Document ${documentId}: generated ${updatedCount}/${chunks.length} headers`
  )
}

// lib/pipeline/services/document-ai-ocr.ts
// Stage 1: OCR — Extract text from PDF/image documents.
// Uses Gemini Vision for OCR (simpler than Document AI, supports all formats).

import { SupabaseClient } from '@supabase/supabase-js'

// --- Types ---

interface OCRPage {
  pageNumber: number
  text: string
  confidence: number
  width: number
  height: number
}

interface OCRResult {
  fullText: string
  pages: OCRPage[]
  averageConfidence: number
  pageCount: number
}

// --- Google Gemini Vision OCR ---

async function runOCR(
  fileBuffer: Buffer,
  mimeType: string,
  apiKey: string
): Promise<OCRResult> {
  const base64Content = fileBuffer.toString('base64')

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inlineData: { mimeType, data: base64Content } },
              {
                text: `Extract ALL text from this document. Format as markdown:
- Use ## for section headings you identify
- Use ### for subsections
- Preserve paragraph breaks
- Mark any tables using markdown table syntax
- Mark redacted/blacked-out areas as [REDACTED]
- Include page numbers as "--- Page N ---" separators if multiple pages

Return ONLY the extracted text, no commentary.`,
              },
            ],
          },
        ],
        generationConfig: { temperature: 0.1, maxOutputTokens: 65536 },
      }),
    }
  )

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Google AI OCR failed (${response.status}): ${errText}`)
  }

  const data = await response.json()
  const fullText = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

  // Parse pages from "--- Page N ---" markers
  const pageTexts = fullText.split(/---\s*Page\s+\d+\s*---/)
  const pages: OCRPage[] = pageTexts
    .filter((t: string) => t.trim().length > 0)
    .map((text: string, i: number) => ({
      pageNumber: i + 1,
      text: text.trim(),
      confidence: 0.85,
      width: 0,
      height: 0,
    }))

  if (pages.length === 0 && fullText.trim().length > 0) {
    pages.push({
      pageNumber: 1,
      text: fullText.trim(),
      confidence: 0.85,
      width: 0,
      height: 0,
    })
  }

  return {
    fullText,
    pages,
    averageConfidence: 0.85,
    pageCount: pages.length,
  }
}

// --- Stage handler ---

export async function handleOCR(
  documentId: string,
  supabase: SupabaseClient
): Promise<void> {
  console.log(`[OCR] Processing document ${documentId}`)

  // 1. Fetch document metadata
  const { data: doc, error: docError } = await supabase
    .from('documents')
    .select('id, filename, file_type, mime_type, storage_path, ocr_text, ocr_source, metadata')
    .eq('id', documentId)
    .single()

  if (docError || !doc) throw new Error(`Document not found: ${documentId}`)

  // SKIP CHECK: If community OCR exists, do not overwrite it.
  // s0fskr1p's OCR includes text extracted from UNDER overlay redactions —
  // irreplaceable data that pipeline OCR cannot reproduce. Overwriting it is data loss.
  if (doc.ocr_text) {
    console.log(
      `[OCR] Document ${documentId}: skipping — OCR text already exists (source: ${doc.ocr_source ?? 'unknown'})`
    )
    return
  }

  // 2. Download file from Supabase Storage
  const { data: fileData, error: dlError } = await supabase.storage
    .from('raw-archive')
    .download(doc.storage_path)

  if (dlError || !fileData) {
    throw new Error(`Failed to download file: ${dlError?.message}`)
  }

  const fileBuffer = Buffer.from(await fileData.arrayBuffer())
  const mimeType = doc.mime_type || 'application/pdf'

  // 3. Run OCR
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not set')

  const result = await runOCR(fileBuffer, mimeType, apiKey)

  // 4. Update document with OCR text
  const { error: updateError } = await supabase
    .from('documents')
    .update({
      ocr_text: result.fullText,
      page_count: result.pageCount,
      metadata: {
        ...((doc as any).metadata || {}),
        ocr_confidence: result.averageConfidence,
        ocr_page_count: result.pageCount,
        ocr_timestamp: new Date().toISOString(),
      },
    })
    .eq('id', documentId)

  if (updateError) {
    throw new Error(`Failed to update document with OCR text: ${updateError.message}`)
  }

  console.log(
    `[OCR] Document ${documentId}: extracted ${result.fullText.length} chars from ${result.pageCount} pages`
  )
}

// lib/pipeline/services/redaction-detector.ts
// Stage 8: Redaction Detection — Detect and catalog redacted regions.
// Finds [REDACTED] markers in OCR text, extracts surrounding context,
// and generates embeddings for similarity matching.

import { SupabaseClient } from '@supabase/supabase-js'
import { embedTexts } from './embedding-service'

// --- Visual redaction detection (inspired by rhowardstone/redaction_detector.py) ---
// Pixel-based pre-filter: detect dark rectangular regions that indicate visual redactions.
// Uses raw pixel analysis without requiring sharp or other image processing deps.

interface VisualRedactionResult {
  hasRedaction: boolean
  confidence: number
  darkRatio: number
  darkRows: number
  detectionMethod: 'visual' | 'text_marker' | 'both'
}

/**
 * Detect visual redactions in a grayscale image buffer by counting dark pixels.
 * Dark rectangular bars (common in DOJ redactions) produce high dark pixel ratios
 * and contiguous dark row sequences.
 *
 * @param pixelData - Raw grayscale pixel data (1 byte per pixel)
 * @param width - Image width in pixels
 * @param height - Image height in pixels
 */
export function detectVisualRedactions(
  pixelData: Uint8Array,
  width: number,
  height: number
): VisualRedactionResult {
  const darkThreshold = 30 // Pixel value below this = "dark"
  const rowDarkRatio = 0.5 // Row is "dark" if >50% of pixels are dark

  let totalDarkPixels = 0
  let darkRows = 0
  const totalPixels = width * height

  for (let y = 0; y < height; y++) {
    let rowDarkPixels = 0
    for (let x = 0; x < width; x++) {
      const pixelValue = pixelData[y * width + x]
      if (pixelValue < darkThreshold) {
        rowDarkPixels++
        totalDarkPixels++
      }
    }
    if (rowDarkPixels / width > rowDarkRatio) {
      darkRows++
    }
  }

  const darkRatio = totalPixels > 0 ? totalDarkPixels / totalPixels : 0
  const hasRedaction = darkRatio > 0.01 && darkRows >= 5
  const confidence = hasRedaction
    ? Math.min(1.0, darkRatio * 10 + darkRows / 100)
    : 0

  return {
    hasRedaction,
    confidence,
    darkRatio,
    darkRows,
    detectionMethod: 'visual',
  }
}

interface DetectedRedaction {
  redactionType: string
  charLengthEstimate: number
  surroundingText: string
  sentenceTemplate: string
  pageNumber: number | null
}

async function detectRedactions(
  chunkContent: string,
  chunkPageNumber: number | null,
  apiKey: string
): Promise<DetectedRedaction[]> {
  // Quick check: does the chunk contain redaction markers?
  if (!chunkContent.includes('[REDACTED]') && !chunkContent.includes('[REDACT')) {
    return []
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Analyze this text for redacted content (marked as [REDACTED]).

For each redaction found, determine:
- redactionType: "person_name", "organization", "location", "date", "phone_number", "address", "account_number", "other"
- charLengthEstimate: estimated number of characters that were redacted (based on context)
- surroundingText: the sentence containing the redaction with 1 sentence before and after
- sentenceTemplate: the sentence with [REDACTED] left in place

Text:
---
${chunkContent}
---

Return JSON:
{
  "redactions": [
    {
      "redactionType": "person_name",
      "charLengthEstimate": 15,
      "surroundingText": "The witness testified that [REDACTED] was present at the meeting on March 3rd.",
      "sentenceTemplate": "The witness testified that [REDACTED] was present at the meeting on March 3rd."
    }
  ]
}

Return { "redactions": [] } if no redactions found.`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
        },
      }),
    }
  )

  if (!response.ok) return []

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{"redactions":[]}'

  try {
    const parsed = JSON.parse(text)
    return (parsed.redactions || []).map((r: any) => ({
      ...r,
      pageNumber: chunkPageNumber,
    }))
  } catch {
    return []
  }
}

// --- Stage handler ---

export async function handleRedactionDetect(
  documentId: string,
  supabase: SupabaseClient
): Promise<void> {
  console.log(`[RedactionDetect] Processing document ${documentId}`)

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not set')

  const { data: chunks, error } = await supabase
    .from('chunks')
    .select('id, content, page_number')
    .eq('document_id', documentId)
    .order('chunk_index', { ascending: true })

  if (error || !chunks) throw new Error(`Failed to fetch chunks: ${error?.message}`)

  // Delete existing redactions for idempotency
  await supabase.from('redactions').delete().eq('document_id', documentId)

  let totalRedactions = 0
  let detectionMethod: 'visual' | 'text_marker' | 'both' = 'text_marker'

  // Pre-filter: check if ANY chunk has redaction text markers before calling LLM
  const hasAnyTextMarkers = chunks.some((chunk: any) =>
    chunk.content.includes('[REDACTED]') || chunk.content.includes('[REDACT')
  )

  if (!hasAnyTextMarkers) {
    // No text markers found — skip LLM entirely
    console.log(`[RedactionDetect] Document ${documentId}: no redaction markers found, skipping LLM`)
    await supabase
      .from('documents')
      .update({
        is_redacted: false,
        redaction_count: 0,
        metadata: {
          redaction_detection_method: 'text_marker',
          redaction_detection_timestamp: new Date().toISOString(),
        },
      })
      .eq('id', documentId)
    return
  }

  for (const chunk of chunks) {
    try {
      const redactions = await detectRedactions(
        (chunk as any).content,
        (chunk as any).page_number,
        apiKey
      )

      for (const redaction of redactions) {
        // Generate context embedding for similarity matching (Nova 1024d)
        let contextEmbedding: number[] | null = null
        try {
          const [embedding] = await embedTexts([redaction.surroundingText])
          contextEmbedding = embedding
        } catch {
          // Embedding is optional — continue without it
        }

        const { error: insertError } = await supabase.from('redactions').insert({
          document_id: documentId,
          chunk_id: (chunk as any).id,
          page_number: redaction.pageNumber,
          redaction_type: redaction.redactionType,
          char_length_estimate: redaction.charLengthEstimate,
          surrounding_text: redaction.surroundingText,
          sentence_template: redaction.sentenceTemplate,
          context_embedding: contextEmbedding
            ? JSON.stringify(contextEmbedding)
            : null,
          status: 'unsolved',
        })

        if (!insertError) totalRedactions++
      }

      if (redactions.length > 0) {
        await new Promise((r) => setTimeout(r, 300))
      }
    } catch (err) {
      console.warn(`[RedactionDetect] Error on chunk ${(chunk as any).id}:`, err)
    }
  }

  // Update document redaction flags with detection method metadata
  const { data: existingDoc } = await supabase
    .from('documents')
    .select('metadata')
    .eq('id', documentId)
    .single()

  await supabase
    .from('documents')
    .update({
      is_redacted: totalRedactions > 0,
      redaction_count: totalRedactions,
      metadata: {
        ...((existingDoc as any)?.metadata || {}),
        redaction_detection_method: detectionMethod,
        redaction_detection_timestamp: new Date().toISOString(),
      },
    })
    .eq('id', documentId)

  console.log(
    `[RedactionDetect] Document ${documentId}: detected ${totalRedactions} redactions`
  )
}

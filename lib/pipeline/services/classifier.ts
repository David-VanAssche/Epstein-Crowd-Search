// lib/pipeline/services/classifier.ts
// Stage 2: Classification — Classify documents into one of 16 types.
// Uses Gemini Flash with structured JSON output.

import { SupabaseClient } from '@supabase/supabase-js'

export const DOCUMENT_TYPES = [
  'deposition',
  'flight_log',
  'financial_record',
  'police_report',
  'court_filing',
  'correspondence',
  'phone_record',
  'address_book',
  'fbi_report',
  'grand_jury_testimony',
  'witness_statement',
  'property_record',
  'medical_record',
  'photograph',
  'news_clipping',
  'other',
] as const

export type DocumentType = (typeof DOCUMENT_TYPES)[number]

interface ClassificationResult {
  type: DocumentType
  confidence: number
  reasoning: string
}

async function classifyDocument(
  ocrText: string,
  filename: string,
  apiKey: string
): Promise<ClassificationResult> {
  // Use first 3000 + last 1000 chars (saves tokens on long documents)
  const textSample =
    ocrText.length > 4000
      ? ocrText.slice(0, 3000) + '\n...\n' + ocrText.slice(-1000)
      : ocrText

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
                text: `Classify this document into exactly one of these types:
${DOCUMENT_TYPES.map((t) => `- ${t}`).join('\n')}

Filename: ${filename}

Document text (excerpt):
---
${textSample}
---

Respond with JSON only:
{
  "type": "<one of the types above>",
  "confidence": <0.0-1.0>,
  "reasoning": "<1 sentence explaining why>"
}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 256,
          responseMimeType: 'application/json',
        },
      }),
    }
  )

  if (!response.ok) {
    throw new Error(`Classification API failed: ${response.status}`)
  }

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'

  try {
    const parsed = JSON.parse(text)
    const docType = DOCUMENT_TYPES.includes(parsed.type) ? parsed.type : 'other'
    return {
      type: docType as DocumentType,
      confidence: Math.min(1.0, Math.max(0.0, parsed.confidence || 0.5)),
      reasoning: parsed.reasoning || '',
    }
  } catch {
    return {
      type: 'other',
      confidence: 0.3,
      reasoning: 'Failed to parse classification response',
    }
  }
}

// --- Stage handler ---

export async function handleClassify(
  documentId: string,
  supabase: SupabaseClient
): Promise<void> {
  console.log(`[Classify] Processing document ${documentId}`)

  const { data: doc, error } = await supabase
    .from('documents')
    .select('id, filename, ocr_text, metadata')
    .eq('id', documentId)
    .single()

  if (error || !doc) throw new Error(`Document not found: ${documentId}`)
  if (!doc.ocr_text) throw new Error(`Document ${documentId} has no OCR text — run OCR first`)

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not set')

  const result = await classifyDocument(doc.ocr_text, doc.filename, apiKey)

  const { error: updateError } = await supabase
    .from('documents')
    .update({
      classification: result.type,
      classification_confidence: result.confidence,
      metadata: {
        ...((doc as any).metadata || {}),
        classification_reasoning: result.reasoning,
        classification_timestamp: new Date().toISOString(),
      },
    })
    .eq('id', documentId)

  if (updateError) {
    throw new Error(`Failed to update classification: ${updateError.message}`)
  }

  console.log(
    `[Classify] Document ${documentId}: ${result.type} (confidence: ${result.confidence.toFixed(2)})`
  )
}

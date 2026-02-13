// lib/pipeline/services/document-summarizer.ts
// Stage 10: Document Summary — Generate executive summary per document.
// Runs after entity extraction for maximum context.

import { SupabaseClient } from '@supabase/supabase-js'

interface DocumentSummary {
  summary: string
  keyPeople: string[]
  timePeriod: string | null
  significance: string
  potentialCriminalIndicators: string[]
}

async function generateSummary(
  ocrText: string,
  classification: string,
  entityNames: string[],
  apiKey: string
): Promise<DocumentSummary> {
  // Use first 8000 + last 2000 chars for summary
  const textSample =
    ocrText.length > 10000
      ? ocrText.slice(0, 8000) + '\n...\n' + ocrText.slice(-2000)
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
                text: `Generate an executive summary of this ${classification} document.

Known entities in this document: ${entityNames.slice(0, 20).join(', ')}

Document text:
---
${textSample}
---

Provide JSON:
{
  "summary": "<3-5 sentence executive summary of what this document is and its key content>",
  "keyPeople": ["<names of most important people mentioned>"],
  "timePeriod": "<date range covered, e.g. 'March-July 2003' or null>",
  "significance": "<1 sentence on why this document matters for the investigation>",
  "potentialCriminalIndicators": ["<brief descriptions of any content suggesting trafficking, obstruction, conspiracy, or financial crimes>"]
}

Be factual. For potentialCriminalIndicators, flag patterns — never make accusations.`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1024,
          responseMimeType: 'application/json',
        },
      }),
    }
  )

  if (!response.ok) {
    throw new Error(`Summary API failed: ${response.status}`)
  }

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'

  try {
    return JSON.parse(text) as DocumentSummary
  } catch {
    return {
      summary: 'Summary generation failed.',
      keyPeople: [],
      timePeriod: null,
      significance: '',
      potentialCriminalIndicators: [],
    }
  }
}

// --- Stage handler ---

export async function handleSummarize(
  documentId: string,
  supabase: SupabaseClient
): Promise<void> {
  console.log(`[Summarize] Processing document ${documentId}`)

  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) throw new Error('GOOGLE_AI_API_KEY not set')

  const { data: doc, error } = await supabase
    .from('documents')
    .select('id, ocr_text, classification, metadata')
    .eq('id', documentId)
    .single()

  if (error || !doc) throw new Error(`Document not found: ${documentId}`)
  if (!(doc as any).ocr_text) throw new Error(`Document ${documentId} has no OCR text`)

  // Get entity names mentioned in this document
  const { data: mentions } = await supabase
    .from('entity_mentions')
    .select('entities(name)')
    .eq('document_id', documentId)

  const entityNames = [
    ...new Set((mentions || []).map((m: any) => m.entities?.name).filter(Boolean)),
  ] as string[]

  const summary = await generateSummary(
    (doc as any).ocr_text,
    (doc as any).classification || 'unknown',
    entityNames,
    apiKey
  )

  // Merge summary into existing metadata
  const existingMetadata = ((doc as any).metadata as Record<string, unknown>) || {}
  const { error: updateError } = await supabase
    .from('documents')
    .update({
      metadata: {
        ...existingMetadata,
        summary: summary.summary,
        key_people: summary.keyPeople,
        time_period: summary.timePeriod,
        significance: summary.significance,
        criminal_indicators: summary.potentialCriminalIndicators,
        summary_timestamp: new Date().toISOString(),
      },
    })
    .eq('id', documentId)

  if (updateError) {
    throw new Error(`Failed to update document summary: ${updateError.message}`)
  }

  console.log(`[Summarize] Document ${documentId}: summary generated (${summary.summary.length} chars)`)
}

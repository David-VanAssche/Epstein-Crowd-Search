// lib/pipeline/services/criminal-indicator-scorer.ts
// Stage 11: Criminal Indicator Scoring — Flag evidence of crimes.
// CRITICAL ETHICAL NOTE: Flags patterns for human review — never makes accusations.

import { SupabaseClient } from '@supabase/supabase-js'

const INDICATOR_CATEGORIES = [
  'trafficking',
  'obstruction',
  'conspiracy',
  'financial_crimes',
  'witness_tampering',
  'exploitation',
] as const

type IndicatorCategory = (typeof INDICATOR_CATEGORIES)[number]

interface CriminalIndicator {
  category: IndicatorCategory
  severity: 'low' | 'medium' | 'high'
  description: string
  evidenceSnippet: string
  confidence: number
}

async function analyzeCriminalIndicators(
  ocrTextSample: string,
  classification: string,
  entities: string[],
  apiKey: string
): Promise<CriminalIndicator[]> {
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
                text: `Analyze this ${classification} document for patterns that may indicate criminal activity.

Categories to check:
- trafficking: travel patterns with minors, exploitation language, grooming indicators
- obstruction: document destruction references, witness intimidation, evidence concealment
- conspiracy: coordination language, coded communication, planning references
- financial_crimes: money laundering patterns, hidden assets, unreported transfers
- witness_tampering: threats to witnesses, incentives for silence, intimidation
- exploitation: power dynamics, coercion references, abuse indicators

Known entities in document: ${entities.slice(0, 10).join(', ')}

Document text:
---
${ocrTextSample}
---

For each indicator found, provide:
- category: one of the categories above
- severity: "low", "medium", or "high"
- description: what pattern was detected and why it's notable
- evidenceSnippet: the relevant text excerpt (max 200 chars)
- confidence: 0.0-1.0

IMPORTANT: Flag patterns for human review only. Do NOT make accusations.

Return JSON: { "indicators": [...] }
Return { "indicators": [] } if no indicators found.`,
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
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{"indicators":[]}'

  try {
    return JSON.parse(text).indicators || []
  } catch {
    return []
  }
}

// --- Stage handler ---

export async function handleCriminalIndicators(
  documentId: string,
  supabase: SupabaseClient
): Promise<void> {
  console.log(`[CriminalIndicators] Processing document ${documentId}`)

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not set')

  const { data: doc, error } = await supabase
    .from('documents')
    .select('id, ocr_text, classification, metadata')
    .eq('id', documentId)
    .single()

  if (error || !doc) throw new Error(`Document not found: ${documentId}`)
  if (!(doc as any).ocr_text) return

  const { data: mentions } = await supabase
    .from('entity_mentions')
    .select('entities(name)')
    .eq('document_id', documentId)

  const entityNames = [
    ...new Set((mentions || []).map((m: any) => m.entities?.name).filter(Boolean)),
  ] as string[]

  const ocrText = (doc as any).ocr_text as string
  const textSample =
    ocrText.length > 10000
      ? ocrText.slice(0, 8000) + '\n...\n' + ocrText.slice(-2000)
      : ocrText

  const indicators = await analyzeCriminalIndicators(
    textSample,
    (doc as any).classification || 'unknown',
    entityNames,
    apiKey
  )

  // Store indicators in document metadata
  const existingMetadata = ((doc as any).metadata as Record<string, unknown>) || {}
  await supabase
    .from('documents')
    .update({
      metadata: {
        ...existingMetadata,
        criminal_indicators: indicators,
        criminal_indicator_count: indicators.length,
        criminal_indicator_timestamp: new Date().toISOString(),
      },
    })
    .eq('id', documentId)

  console.log(
    `[CriminalIndicators] Document ${documentId}: found ${indicators.length} indicators`
  )
}

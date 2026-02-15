// lib/pipeline/services/criminal-indicator-scorer.ts
// Stage 11: Criminal Indicator Scoring — Flag evidence of crimes.
// CRITICAL ETHICAL NOTE: Flags patterns for human review — never makes accusations.

import { SupabaseClient } from '@supabase/supabase-js'
import { buildPromptContext, buildCriminalIndicatorPrompt } from '@/lib/pipeline/prompts'
import type { PromptContext } from '@/lib/pipeline/prompts'

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
  ctx: PromptContext,
  entities: string[],
  apiKey: string
): Promise<CriminalIndicator[]> {
  const prompt = buildCriminalIndicatorPrompt(ctx, entities, ocrTextSample)

  // Contacts tier returns empty prompt — no meaningful criminal indicators
  if (!prompt) return []

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
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
    .select('id, ocr_text, classification, classification_confidence, classification_tags, filename, metadata')
    .eq('id', documentId)
    .single()

  if (error || !doc) throw new Error(`Document not found: ${documentId}`)
  if (!(doc as any).ocr_text) return

  let ctx: PromptContext
  try {
    ctx = buildPromptContext(
      (doc as any).classification || 'other',
      ((doc as any).classification_tags as string[]) || [],
      {
        documentId,
        filename: (doc as any).filename || '',
        primaryConfidence: (doc as any).classification_confidence ?? 0,
      }
    )
  } catch {
    console.warn(`[CriminalIndicators] PromptContext build failed for ${documentId}, using default tier`)
    ctx = buildPromptContext('other', [], { documentId, filename: '', primaryConfidence: 0 })
  }

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
    ctx,
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

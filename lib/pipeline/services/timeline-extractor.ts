// lib/pipeline/services/timeline-extractor.ts
// Stage 9: Timeline Extraction — Extract dated events from document chunks.
// Creates timeline_events records linked to entities and source documents.

import { SupabaseClient } from '@supabase/supabase-js'
import { normalizeEntityName } from '@/lib/utils/normalize-entity-name'
import { buildPromptContext, buildTimelineExtractionPrompt } from '@/lib/pipeline/prompts'
import type { PromptContext } from '@/lib/pipeline/prompts'

interface ExtractedEvent {
  date: string | null
  datePrecision: 'exact' | 'month' | 'year' | 'approximate'
  dateDisplay: string
  description: string
  eventType: string
  location: string | null
  entityNames: string[]
}

async function extractTimelineEvents(
  chunkContent: string,
  ctx: PromptContext,
  apiKey: string
): Promise<ExtractedEvent[]> {
  const prompt = buildTimelineExtractionPrompt(ctx, chunkContent)

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
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{"events":[]}'

  try {
    return JSON.parse(text).events || []
  } catch {
    return []
  }
}

// --- Stage handler ---

export async function handleTimelineExtract(
  documentId: string,
  supabase: SupabaseClient
): Promise<void> {
  console.log(`[Timeline] Processing document ${documentId}`)

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not set')

  const { data: doc } = await supabase
    .from('documents')
    .select('classification, classification_confidence, classification_tags, filename')
    .eq('id', documentId)
    .single()

  let ctx: PromptContext
  try {
    ctx = buildPromptContext(
      (doc as any)?.classification || 'other',
      ((doc as any)?.classification_tags as string[]) || [],
      {
        documentId,
        filename: (doc as any)?.filename || '',
        primaryConfidence: (doc as any)?.classification_confidence ?? 0,
      }
    )
  } catch {
    console.warn(`[Timeline] PromptContext build failed for ${documentId}, using default tier`)
    ctx = buildPromptContext('other', [], { documentId, filename: '', primaryConfidence: 0 })
  }

  const { data: chunks, error } = await supabase
    .from('chunks')
    .select('id, content')
    .eq('document_id', documentId)
    .order('chunk_index', { ascending: true })

  if (error || !chunks) throw new Error(`Failed to fetch chunks: ${error?.message}`)

  let totalEvents = 0

  for (const chunk of chunks) {
    try {
      const events = await extractTimelineEvents(
        (chunk as any).content,
        ctx,
        apiKey
      )

      for (const event of events) {
        // Resolve entity names to IDs
        const entityIds: string[] = []
        for (const name of event.entityNames || []) {
          const normalized = normalizeEntityName(name)
          if (!normalized) continue
          const { data: entity } = await supabase
            .from('entities')
            .select('id')
            .eq('name_normalized', normalized)
            .maybeSingle()
          if (entity) entityIds.push((entity as any).id)
        }

        const { error: insertError } = await supabase.from('timeline_events').insert({
          event_date: event.date,
          date_precision: event.datePrecision,
          date_display: event.dateDisplay,
          description: event.description,
          event_type: event.eventType,
          location: event.location,
          source_chunk_ids: [(chunk as any).id],
          source_document_ids: [documentId],
          entity_ids: entityIds,
        })

        if (!insertError) totalEvents++
      }

      if (events.length > 0) {
        await new Promise((r) => setTimeout(r, 200))
      }
    } catch (err) {
      console.warn(`[Timeline] Error on chunk ${(chunk as any).id}:`, err)
    }
  }

  console.log(`[Timeline] Document ${documentId}: extracted ${totalEvents} events`)
}

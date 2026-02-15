// lib/pipeline/services/relationship-mapper.ts
// Stage 7: Relationship Mapping — Identify entity-to-entity relationships.
// Uses Gemini Flash to analyze chunks where multiple entities co-occur.

import { SupabaseClient } from '@supabase/supabase-js'
import { buildPromptContext, buildRelationshipMappingPrompt, PROMPT_VERSION, RELATIONSHIP_TYPES_BY_TIER } from '@/lib/pipeline/prompts'
import type { PromptContext } from '@/lib/pipeline/prompts'
import type { RelationshipType } from '@/types/entities'

// Derive validation set from the prompt system's canonical list (DRY)
const VALID_RELATIONSHIP_TYPES = new Set<string>(RELATIONSHIP_TYPES_BY_TIER.default.all)

interface ExtractedRelationship {
  entityA: string
  entityB: string
  type: string
  description: string
  confidence: number
}

async function extractRelationships(
  chunkContent: string,
  entityNames: string[],
  ctx: PromptContext,
  apiKey: string
): Promise<ExtractedRelationship[]> {
  if (entityNames.length < 2) return []

  const prompt = buildRelationshipMappingPrompt(ctx, entityNames, chunkContent)

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
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]'

  try {
    const parsed = JSON.parse(text) as ExtractedRelationship[]
    // Validate against canonical type set
    return parsed.filter((r) => VALID_RELATIONSHIP_TYPES.has(r.type))
  } catch {
    return []
  }
}

// --- Stage handler ---

export async function handleRelationshipMap(
  documentId: string,
  supabase: SupabaseClient
): Promise<void> {
  console.log(`[RelMap] Processing document ${documentId}`)

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not set')

  // Get document classification for prompt routing
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
    console.warn(`[RelMap] PromptContext build failed for ${documentId}, using default tier`)
    ctx = buildPromptContext('other', [], { documentId, filename: '', primaryConfidence: 0 })
  }

  // Get all chunks with their entity mentions
  const { data: chunks, error } = await supabase
    .from('chunks')
    .select('id, content')
    .eq('document_id', documentId)
    .order('chunk_index', { ascending: true })

  if (error || !chunks) throw new Error(`Failed to fetch chunks: ${error?.message}`)

  let totalRelationships = 0

  for (const chunk of chunks) {
    // Get entities mentioned in this chunk
    const { data: mentions } = await supabase
      .from('entity_mentions')
      .select('entity_id, mention_text, entities(id, name)')
      .eq('chunk_id', (chunk as any).id)

    if (!mentions || mentions.length < 2) continue

    const entityNames = mentions
      .map((m: any) => m.entities?.name)
      .filter(Boolean) as string[]

    const entityMap = new Map<string, string>()
    for (const m of mentions) {
      const entity = (m as any).entities
      if (entity) entityMap.set(entity.name, entity.id)
    }

    try {
      const relationships = await extractRelationships(
        (chunk as any).content,
        entityNames,
        ctx,
        apiKey
      )

      for (const rel of relationships) {
        const entityAId = entityMap.get(rel.entityA)
        const entityBId = entityMap.get(rel.entityB)
        if (!entityAId || !entityBId || entityAId === entityBId) continue

        // Sort IDs to avoid duplicate A-B / B-A entries
        const [id1, id2] = [entityAId, entityBId].sort()

        // Check for existing relationship to merge evidence arrays
        const { data: existing } = await supabase
          .from('entity_relationships')
          .select('id, evidence_chunk_ids, evidence_document_ids, strength')
          .eq('entity_a_id', id1)
          .eq('entity_b_id', id2)
          .eq('relationship_type', rel.type)
          .maybeSingle()

        if (existing) {
          // Merge evidence arrays (deduplicate)
          const chunkIds = Array.from(new Set([...((existing as any).evidence_chunk_ids || []), (chunk as any).id]))
          const docIds = Array.from(new Set([...((existing as any).evidence_document_ids || []), documentId]))
          const strength = Math.max((existing as any).strength || 0, rel.confidence)
          await supabase
            .from('entity_relationships')
            .update({ evidence_chunk_ids: chunkIds, evidence_document_ids: docIds, strength })
            .eq('id', (existing as any).id)
          totalRelationships++
        } else {
          const { error: insertError } = await supabase
            .from('entity_relationships')
            .insert({
              entity_a_id: id1,
              entity_b_id: id2,
              relationship_type: rel.type as RelationshipType,
              description: rel.description,
              evidence_chunk_ids: [(chunk as any).id],
              evidence_document_ids: [documentId],
              strength: rel.confidence,
            })
          if (!insertError) totalRelationships++
        }
      }

      await new Promise((r) => setTimeout(r, 300))
    } catch (err) {
      console.warn(`[RelMap] Error on chunk ${(chunk as any).id}:`, err)
    }
  }

  console.log(
    `[RelMap] Document ${documentId}: mapped ${totalRelationships} relationships`
  )
}

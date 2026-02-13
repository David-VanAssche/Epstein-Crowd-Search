// lib/pipeline/services/relationship-mapper.ts
// Stage 7: Relationship Mapping — Identify entity-to-entity relationships.
// Uses Gemini Flash to analyze chunks where multiple entities co-occur.

import { SupabaseClient } from '@supabase/supabase-js'

const RELATIONSHIP_TYPES = [
  'traveled_with',
  'employed_by',
  'associate_of',
  'family_member',
  'legal_representative',
  'financial_connection',
  'communicated_with',
  'met_with',
  'referenced_together',
  'victim_of',
  'witness_against',
] as const

type RelationshipType = (typeof RELATIONSHIP_TYPES)[number]

interface ExtractedRelationship {
  entityA: string
  entityB: string
  type: RelationshipType
  description: string
  confidence: number
}

async function extractRelationships(
  chunkContent: string,
  entityNames: string[],
  apiKey: string
): Promise<ExtractedRelationship[]> {
  if (entityNames.length < 2) return []

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
                text: `Given this text and the entities mentioned in it, identify relationships between entity pairs.

Entities present: ${entityNames.join(', ')}

Relationship types: ${RELATIONSHIP_TYPES.join(', ')}

Text:
---
${chunkContent}
---

For each relationship found, provide:
- entityA: name of first entity
- entityB: name of second entity
- type: one of the relationship types above
- description: 1 sentence describing the relationship evidence
- confidence: 0.0-1.0

Return JSON array:
[{"entityA":"...","entityB":"...","type":"...","description":"...","confidence":0.8}]

Return [] if no relationships found. Only include relationships clearly supported by the text.`,
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
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]'

  try {
    const parsed = JSON.parse(text) as ExtractedRelationship[]
    return parsed.filter((r) => RELATIONSHIP_TYPES.includes(r.type as RelationshipType))
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

  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) throw new Error('GOOGLE_AI_API_KEY not set')

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
        apiKey
      )

      for (const rel of relationships) {
        const entityAId = entityMap.get(rel.entityA)
        const entityBId = entityMap.get(rel.entityB)
        if (!entityAId || !entityBId || entityAId === entityBId) continue

        // Sort IDs to avoid duplicate A-B / B-A entries
        const [id1, id2] = [entityAId, entityBId].sort()

        const { error: insertError } = await supabase
          .from('entity_relationships')
          .upsert(
            {
              entity_a_id: id1,
              entity_b_id: id2,
              relationship_type: rel.type,
              description: rel.description,
              evidence_chunk_ids: [(chunk as any).id],
              evidence_document_ids: [documentId],
              strength: rel.confidence,
            },
            { onConflict: 'entity_a_id,entity_b_id,relationship_type' }
          )

        if (!insertError) totalRelationships++
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

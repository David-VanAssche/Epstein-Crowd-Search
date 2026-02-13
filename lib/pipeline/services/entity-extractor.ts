// lib/pipeline/services/entity-extractor.ts
// Stage 6: Entity Extraction — Extract named entities from document chunks.
// Uses Gemini Flash with structured JSON output.
// Deduplicates against existing entities by name matching.

import { SupabaseClient } from '@supabase/supabase-js'

const ENTITY_TYPES = [
  'person',
  'organization',
  'location',
  'aircraft',
  'vessel',
  'property',
  'account',
] as const

type EntityType = (typeof ENTITY_TYPES)[number]

interface ExtractedEntity {
  name: string
  type: EntityType
  aliases: string[]
  mentionText: string
  contextSnippet: string
  confidence: number
}

interface ExtractedEntities {
  entities: ExtractedEntity[]
}

async function extractEntitiesFromChunk(
  chunkContent: string,
  documentType: string,
  apiKey: string
): Promise<ExtractedEntities> {
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
                text: `Extract all named entities from this text chunk of a ${documentType} document.

Entity types: ${ENTITY_TYPES.join(', ')}

Text:
---
${chunkContent}
---

For each entity found, provide:
- name: The canonical name (e.g., "Jeffrey Epstein" not "Epstein" or "Mr. Epstein")
- type: One of the entity types above
- aliases: Any alternate names/forms used in the text
- mentionText: The exact text mention in the chunk
- contextSnippet: 1-2 sentences surrounding the mention
- confidence: 0.0-1.0 how confident you are this is a real entity

Return JSON:
{
  "entities": [
    {
      "name": "...",
      "type": "...",
      "aliases": ["..."],
      "mentionText": "...",
      "contextSnippet": "...",
      "confidence": 0.95
    }
  ]
}

If no entities found, return { "entities": [] }.
Be thorough — extract ALL people, organizations, locations, aircraft, vessels, properties, and accounts mentioned.`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
        },
      }),
    }
  )

  if (!response.ok) {
    throw new Error(`Entity extraction API failed: ${response.status}`)
  }

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{"entities":[]}'

  try {
    const parsed = JSON.parse(text) as ExtractedEntities
    // Validate entity types
    parsed.entities = parsed.entities.filter((e) =>
      ENTITY_TYPES.includes(e.type as EntityType)
    )
    return parsed
  } catch {
    return { entities: [] }
  }
}

/**
 * Find or create an entity in the database.
 * Matches by exact name + type first.
 */
async function findOrCreateEntity(
  entity: ExtractedEntity,
  supabase: SupabaseClient
): Promise<string> {
  // Try exact match first
  const { data: existing } = await supabase
    .from('entities')
    .select('id, aliases, mention_count')
    .eq('name', entity.name)
    .eq('entity_type', entity.type)
    .single()

  if (existing) {
    // Merge aliases
    const allAliases = new Set([...((existing as any).aliases || []), ...entity.aliases])
    await supabase
      .from('entities')
      .update({
        aliases: Array.from(allAliases),
        mention_count: ((existing as any).mention_count || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', (existing as any).id)

    return (existing as any).id
  }

  // Create new entity
  const { data: created, error } = await supabase
    .from('entities')
    .insert({
      name: entity.name,
      entity_type: entity.type,
      aliases: entity.aliases,
      mention_count: 1,
      metadata: {},
    })
    .select('id')
    .single()

  if (error) throw new Error(`Failed to create entity: ${error.message}`)
  return (created as any).id
}

// --- Stage handler ---

export async function handleEntityExtract(
  documentId: string,
  supabase: SupabaseClient
): Promise<void> {
  console.log(`[EntityExtract] Processing document ${documentId}`)

  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) throw new Error('GOOGLE_AI_API_KEY not set')

  // Get document type for context
  const { data: doc } = await supabase
    .from('documents')
    .select('classification')
    .eq('id', documentId)
    .single()

  const documentType = (doc as any)?.classification || 'unknown'

  // Get all chunks
  const { data: chunks, error } = await supabase
    .from('chunks')
    .select('id, content, page_number')
    .eq('document_id', documentId)
    .order('chunk_index', { ascending: true })

  if (error || !chunks) throw new Error(`Failed to fetch chunks: ${error?.message}`)

  // IDEMPOTENCY CHECK: Skip if entity mentions already exist for this document.
  const { count: existingMentions } = await supabase
    .from('entity_mentions')
    .select('id', { count: 'exact', head: true })
    .eq('document_id', documentId)

  if (existingMentions && existingMentions > 0) {
    console.log(
      `[EntityExtract] Document ${documentId}: skipping — ${existingMentions} mentions already exist`
    )
    return
  }

  let totalEntities = 0
  let totalMentions = 0
  const documentEntityIds = new Set<string>()

  for (const chunk of chunks) {
    try {
      const extracted = await extractEntitiesFromChunk(
        (chunk as any).content,
        documentType,
        apiKey
      )

      for (const entity of extracted.entities) {
        if (entity.confidence < 0.5) continue // Skip low-confidence

        const entityId = await findOrCreateEntity(entity, supabase)
        documentEntityIds.add(entityId)

        // Create entity_mention
        const { error: mentionError } = await supabase.from('entity_mentions').insert({
          entity_id: entityId,
          chunk_id: (chunk as any).id,
          document_id: documentId,
          mention_text: entity.mentionText,
          context_snippet: entity.contextSnippet,
          mention_type: 'direct',
          confidence: entity.confidence,
          page_number: (chunk as any).page_number,
        })

        if (!mentionError) totalMentions++
        totalEntities++
      }

      // Rate limiting between chunks
      await new Promise((r) => setTimeout(r, 200))
    } catch (err) {
      console.warn(`[EntityExtract] Error on chunk ${(chunk as any).id}:`, err)
    }
  }

  // Update document_count on affected entities
  for (const entityId of documentEntityIds) {
    await supabase
      .from('entities')
      .update({ document_count: documentEntityIds.size })
      .eq('id', entityId)
  }

  console.log(
    `[EntityExtract] Document ${documentId}: extracted ${totalEntities} entities, ${totalMentions} mentions`
  )
}

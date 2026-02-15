// lib/pipeline/services/entity-extractor.ts
// Stage 6: Entity Extraction — Extract named entities from document chunks.
// Uses Gemini Flash with structured JSON output.
// Deduplicates against existing entities by name matching.

import { SupabaseClient } from '@supabase/supabase-js'
import { normalizeEntityName } from '@/lib/utils/normalize-entity-name'
import { isJunkEntity } from '@/lib/utils/junk-entity-filter'
import { buildPromptContext, buildEntityExtractionPrompt, PROMPT_VERSION } from '@/lib/pipeline/prompts'
import type { PromptContext } from '@/lib/pipeline/prompts'

const ENTITY_TYPES = [
  'person',
  'organization',
  'location',
  'aircraft',
  'vessel',
  'property',
  'account',
  'event',
  'legal_case',
  'government_body',
  'trust',
  'phone_number',
  'vehicle',
  'document_reference',
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
  ctx: PromptContext,
  apiKey: string
): Promise<ExtractedEntities> {
  const prompt = buildEntityExtractionPrompt(ctx, chunkContent)

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
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
 * Matches by normalized name + type for dedup-safe lookups.
 * Returns null if the entity is a known false positive (junk).
 */
async function findOrCreateEntity(
  entity: ExtractedEntity,
  supabase: SupabaseClient
): Promise<string | null> {
  // Filter junk entities before creating
  if (isJunkEntity(entity.name)) return null

  const normalized = normalizeEntityName(entity.name)
  if (!normalized || normalized.length <= 1) return null

  // Match by normalized name + type (dedup-safe)
  // Use maybeSingle() — returns null if no match (single() throws on 0 rows)
  const { data: existing } = await supabase
    .from('entities')
    .select('id, aliases, mention_count')
    .eq('name_normalized', normalized)
    .eq('entity_type', entity.type)
    .maybeSingle()

  if (existing) {
    // Merge aliases
    const allAliases = new Set([...((existing as any).aliases || []), ...(entity.aliases || [])])
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

  // Create new entity with name_normalized
  const { data: created, error } = await supabase
    .from('entities')
    .insert({
      name: entity.name,
      name_normalized: normalized,
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
    console.warn(`[EntityExtract] PromptContext build failed for ${documentId}, using default tier`)
    ctx = buildPromptContext('other', [], { documentId, filename: '', primaryConfidence: 0 })
  }

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
        ctx,
        apiKey
      )

      for (const entity of extracted.entities) {
        // Clamp confidence to [0, 1] and skip low-confidence
        entity.confidence = Math.max(0, Math.min(1, entity.confidence ?? 0))
        if (entity.confidence < 0.5) continue

        const entityId = await findOrCreateEntity(entity, supabase)
        if (!entityId) continue // Junk entity filtered
        documentEntityIds.add(entityId)

        // Compute evidence weight: doc_probative × mention_type × confidence
        const mentionType = 'direct'
        const docWeight = getDocumentProbativeWeight(documentType)
        const mentionWeight = getMentionTypeWeight(mentionType)
        const evidenceWeight = docWeight * mentionWeight * entity.confidence

        // Create entity_mention with evidence weight
        const { error: mentionError } = await supabase.from('entity_mentions').insert({
          entity_id: entityId,
          chunk_id: (chunk as any).id,
          document_id: documentId,
          mention_text: entity.mentionText,
          context_snippet: entity.contextSnippet,
          mention_type: mentionType,
          confidence: entity.confidence,
          page_number: (chunk as any).page_number,
          evidence_weight: evidenceWeight,
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

  // Increment document_count on affected entities (this document is new for them)
  for (const entityId of documentEntityIds) {
    const { data: ent } = await supabase
      .from('entities')
      .select('document_count')
      .eq('id', entityId)
      .single()
    await supabase
      .from('entities')
      .update({ document_count: ((ent as any)?.document_count || 0) + 1 })
      .eq('id', entityId)
  }

  console.log(
    `[EntityExtract] Document ${documentId}: extracted ${totalEntities} entities, ${totalMentions} mentions`
  )
}

// --- Evidence weight helpers (mirrors SQL functions) ---

function getDocumentProbativeWeight(classification: string): number {
  switch (classification?.toLowerCase()) {
    // Tier 1: Sworn testimony
    case 'deposition':
    case 'grand_jury_testimony':
    case 'witness_statement':
    case 'plea_agreement':
      return 1.0
    // Tier 2: Official documents
    case 'court_filing':
    case 'indictment':
    case 'subpoena':
    case 'search_warrant':
    case 'police_report':
    case 'fbi_report':
    case 'government_report':
      return 0.7
    // Tier 3: Records
    case 'flight_log':
    case 'financial_record':
    case 'tax_filing':
    case 'trust_document':
    case 'phone_record':
    case 'medical_record':
    case 'corporate_filing':
    case 'property_record':
      return 0.4
    // Tier 4: Correspondence
    case 'correspondence':
    case 'email':
    case 'letter':
    case 'memo':
    case 'fax':
      return 0.2
    // Tier 5: Peripheral
    case 'address_book':
    case 'photograph':
    case 'news_clipping':
    case 'calendar_schedule':
    case 'receipt_invoice':
    default:
      return 0.1
  }
}

function getMentionTypeWeight(mentionType: string): number {
  switch (mentionType?.toLowerCase()) {
    case 'direct':
      return 1.0
    case 'indirect':
      return 0.5
    case 'implied':
      return 0.3
    case 'co_occurrence':
    default:
      return 0.15
  }
}

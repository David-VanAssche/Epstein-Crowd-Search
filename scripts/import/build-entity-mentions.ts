// scripts/import/build-entity-mentions.ts
// Builds entity_mentions by grep-matching entity names across chunks.
// No LLM required — pure text matching. This connects entities to documents
// and enables: entity detail pages, document viewer entity sidebar,
// AI chat entity tools, relationship graph evidence links.
//
// Usage: npx tsx scripts/import/build-entity-mentions.ts

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

interface Entity {
  id: string
  name: string
  name_normalized: string
  entity_type: string
  aliases: string[]
}

interface MentionInsert {
  entity_id: string
  chunk_id: string
  document_id: string
  mention_text: string
  context_snippet: string
  mention_type: string
  confidence: number
  page_number: number | null
}

const BATCH_SIZE = 500
const CHUNK_FETCH_SIZE = 1000
const MIN_NAME_LENGTH = 3 // Skip very short names to avoid false positives

// Build case-insensitive regex for an entity name + aliases
function buildPatterns(entity: Entity): { name: string; regex: RegExp }[] {
  const allNames = [entity.name, ...(entity.aliases || [])]
    .filter(n => n && n.length >= MIN_NAME_LENGTH)
    // Deduplicate
    .filter((n, i, arr) => arr.findIndex(x => x.toLowerCase() === n.toLowerCase()) === i)

  return allNames.map(name => {
    // Escape regex special chars, use word boundaries for precision
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return {
      name,
      regex: new RegExp(`\\b${escaped}\\b`, 'gi'),
    }
  })
}

// Extract a context snippet around a match
function extractContext(text: string, matchIndex: number, matchLength: number, windowSize = 100): string {
  const start = Math.max(0, matchIndex - windowSize)
  const end = Math.min(text.length, matchIndex + matchLength + windowSize)
  let snippet = text.slice(start, end)
  if (start > 0) snippet = '...' + snippet
  if (end < text.length) snippet = snippet + '...'
  return snippet
}

async function loadEntities(): Promise<Entity[]> {
  console.log('Loading entities...')

  const entities: Entity[] = []
  let offset = 0

  while (true) {
    const { data, error } = await supabase
      .from('entities')
      .select('id, name, name_normalized, entity_type, aliases')
      .order('mention_count', { ascending: false })
      .range(offset, offset + 999)

    if (error) {
      console.error('Error loading entities:', error.message)
      break
    }
    if (!data || data.length === 0) break

    entities.push(...(data as Entity[]))
    offset += data.length

    if (data.length < 1000) break
  }

  // Filter out very short names that would cause too many false positives
  const filtered = entities.filter(e => e.name.length >= MIN_NAME_LENGTH)
  console.log(`Loaded ${entities.length} entities, ${filtered.length} with names >= ${MIN_NAME_LENGTH} chars`)
  return filtered
}

async function countExistingMentions(): Promise<number> {
  const { count, error } = await supabase
    .from('entity_mentions')
    .select('id', { count: 'exact', head: true })

  if (error) {
    console.error('Error counting existing mentions:', error.message)
    return 0
  }
  return count || 0
}

async function insertMentionsBatch(mentions: MentionInsert[]): Promise<number> {
  if (mentions.length === 0) return 0

  // Use upsert-like approach: insert and ignore conflicts
  const { error } = await supabase
    .from('entity_mentions')
    .insert(mentions)

  if (error) {
    // If it's a duplicate, that's fine — skip
    if (error.message.includes('duplicate') || error.message.includes('unique')) {
      return 0
    }
    console.error(`Error inserting ${mentions.length} mentions:`, error.message)
    return 0
  }

  return mentions.length
}

async function updateEntityCounters(entityDocCounts: Map<string, { mentions: number; docs: Set<string> }>): Promise<void> {
  console.log(`\nUpdating counters for ${entityDocCounts.size} entities...`)

  let updated = 0
  for (const [entityId, counts] of entityDocCounts) {
    const { error } = await supabase
      .from('entities')
      .update({
        mention_count: counts.mentions,
        document_count: counts.docs.size,
        updated_at: new Date().toISOString(),
      })
      .eq('id', entityId)

    if (!error) updated++
  }

  console.log(`Updated ${updated}/${entityDocCounts.size} entity counters`)
}

async function updateDocumentEntityCounts(docEntityCounts: Map<string, number>): Promise<void> {
  console.log(`Updating entity_count for ${docEntityCounts.size} documents...`)

  let updated = 0
  const entries = [...docEntityCounts.entries()]

  for (let i = 0; i < entries.length; i += 50) {
    const batch = entries.slice(i, i + 50)
    for (const [docId, count] of batch) {
      const { error } = await supabase
        .from('documents')
        .update({ entity_count: count })
        .eq('id', docId)

      if (!error) updated++
    }
  }

  console.log(`Updated ${updated}/${docEntityCounts.size} document entity counts`)
}

async function main(): Promise<void> {
  console.log('=== Entity Mention Builder (Text Grep) ===\n')

  const existingCount = await countExistingMentions()
  if (existingCount > 0) {
    console.log(`Found ${existingCount.toLocaleString()} existing entity_mentions.`)
    console.log('Delete them first if you want to rebuild: DELETE FROM entity_mentions;\n')
  }

  const entities = await loadEntities()
  if (entities.length === 0) {
    console.log('No entities to match. Run import-entities.ts first.')
    return
  }

  // Pre-compile patterns for all entities
  console.log('Compiling search patterns...')
  const entityPatterns = entities.map(entity => ({
    entity,
    patterns: buildPatterns(entity),
  })).filter(ep => ep.patterns.length > 0)

  console.log(`${entityPatterns.length} entities with matchable patterns`)

  // Process chunks in batches
  let chunkOffset = 0
  let totalMentionsInserted = 0
  let totalChunksProcessed = 0
  let mentionBuffer: MentionInsert[] = []

  // Track entity-level stats for counter updates
  const entityDocCounts = new Map<string, { mentions: number; docs: Set<string> }>()
  const docEntityCounts = new Map<string, Set<string>>()

  while (true) {
    const { data: chunks, error } = await supabase
      .from('chunks')
      .select('id, document_id, content, page_number')
      .order('id', { ascending: true })
      .range(chunkOffset, chunkOffset + CHUNK_FETCH_SIZE - 1)

    if (error) {
      console.error('Error fetching chunks:', error.message)
      break
    }
    if (!chunks || chunks.length === 0) break

    for (const chunk of chunks) {
      const content = (chunk as any).content as string
      if (!content || content.length < 10) continue

      const contentLower = content.toLowerCase()

      for (const { entity, patterns } of entityPatterns) {
        for (const { name, regex } of patterns) {
          // Quick pre-check: does the name appear at all? (faster than regex)
          if (!contentLower.includes(name.toLowerCase())) continue

          // Run regex for word-boundary matches
          regex.lastIndex = 0
          let match: RegExpExecArray | null
          let matchCount = 0

          while ((match = regex.exec(content)) !== null) {
            matchCount++
            // Only record up to 3 mentions per entity per chunk to avoid spam
            if (matchCount > 3) break

            const contextSnippet = extractContext(content, match.index, match[0].length)

            mentionBuffer.push({
              entity_id: entity.id,
              chunk_id: (chunk as any).id,
              document_id: (chunk as any).document_id,
              mention_text: match[0],
              context_snippet: contextSnippet,
              mention_type: 'direct',
              confidence: name === entity.name ? 0.9 : 0.7, // Lower confidence for alias matches
              page_number: (chunk as any).page_number || null,
            })

            // Track counters
            if (!entityDocCounts.has(entity.id)) {
              entityDocCounts.set(entity.id, { mentions: 0, docs: new Set() })
            }
            const ec = entityDocCounts.get(entity.id)!
            ec.mentions++
            ec.docs.add((chunk as any).document_id)

            if (!docEntityCounts.has((chunk as any).document_id)) {
              docEntityCounts.set((chunk as any).document_id, new Set())
            }
            docEntityCounts.get((chunk as any).document_id)!.add(entity.id)
          }
        }
      }

      totalChunksProcessed++
    }

    // Flush buffer if large enough
    if (mentionBuffer.length >= BATCH_SIZE) {
      const inserted = await insertMentionsBatch(mentionBuffer)
      totalMentionsInserted += inserted
      mentionBuffer = []
    }

    chunkOffset += chunks.length
    if (totalChunksProcessed % 5000 === 0) {
      console.log(`Processed ${totalChunksProcessed.toLocaleString()} chunks, ${totalMentionsInserted.toLocaleString()} mentions inserted...`)
    }

    if (chunks.length < CHUNK_FETCH_SIZE) break
  }

  // Flush remaining
  if (mentionBuffer.length > 0) {
    const inserted = await insertMentionsBatch(mentionBuffer)
    totalMentionsInserted += inserted
  }

  console.log(`\n=== Grep Complete ===`)
  console.log(`Chunks processed: ${totalChunksProcessed.toLocaleString()}`)
  console.log(`Mentions inserted: ${totalMentionsInserted.toLocaleString()}`)
  console.log(`Entities matched: ${entityDocCounts.size}`)
  console.log(`Documents with entities: ${docEntityCounts.size}`)

  // Update denormalized counters
  await updateEntityCounters(entityDocCounts)
  await updateDocumentEntityCounts(
    new Map([...docEntityCounts.entries()].map(([docId, entitySet]) => [docId, entitySet.size]))
  )

  console.log('\nDone.')
}

main().catch(console.error)

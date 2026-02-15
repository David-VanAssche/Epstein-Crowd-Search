// scripts/import/import-relationships.ts
// Imports pre-built entity relationships from epsteininvestigation.org CSV
// into the entity_relationships table, resolving entity names to UUIDs.
//
// Usage: npx tsx scripts/import/import-relationships.ts

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

/** Parse a CSV line respecting quoted fields */
function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current.trim())
  return fields
}

function normalizeEntityName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Map CSV relationship types to DB CHECK constraint values
const VALID_TYPES = new Set([
  'traveled_with', 'employed_by', 'associate_of', 'family_member',
  'legal_representative', 'financial_connection', 'mentioned_together',
  'witness_testimony', 'employer_of', 'guest_of', 'owns', 'controlled_by',
  'beneficiary_of', 'investigated_by', 'prosecuted_by', 'victim_of',
  'co_defendant', 'introduced_by', 'recruited_by', 'located_at',
])

const TYPE_MAP: Record<string, string> = {
  'associate': 'associate_of',
  'social-associate': 'associate_of',
  'business-associate': 'associate_of',
  'co-mentioned': 'mentioned_together',
  'co-passenger': 'traveled_with',
  'co-flight': 'traveled_with',
  'financial-associate': 'financial_connection',
  'financial-client': 'financial_connection',
  'banking': 'financial_connection',
  'employee': 'employed_by',
  'family': 'family_member',
  'legal-counsel': 'legal_representative',
  'legal-action': 'prosecuted_by',
  'prosecution': 'prosecuted_by',
  'investigation': 'investigated_by',
  'victim-perpetrator': 'victim_of',
  'accused': 'victim_of',
  'accused-by': 'victim_of',
  'exploitation': 'victim_of',
  'beneficiary': 'beneficiary_of',
  'ownership': 'owns',
  'founded': 'owns',
}

function mapRelationshipType(raw: string): string | null {
  const lower = raw.toLowerCase().trim()
  if (VALID_TYPES.has(lower)) return lower
  if (TYPE_MAP[lower]) return TYPE_MAP[lower]
  // If the "type" looks like a person name (contains spaces, starts uppercase),
  // it's a CSV parsing artifact — skip it
  if (/^[A-Z]/.test(raw) && raw.includes(' ')) return null
  // Unknown type — fall back to associate_of
  return 'associate_of'
}

async function downloadFile(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from('raw-archive').download(path)
  if (error) {
    console.error(`Error downloading ${path}:`, error)
    return null
  }
  return await data.text()
}

// Cache entity lookups to avoid repeated DB queries
const entityCache = new Map<string, string | null>()

async function resolveEntityId(name: string): Promise<string | null> {
  const normalized = normalizeEntityName(name)
  if (!normalized) return null

  if (entityCache.has(normalized)) return entityCache.get(normalized) || null

  const { data, error } = await supabase
    .from('entities')
    .select('id')
    .eq('name_normalized', normalized)
    .limit(1)
    .maybeSingle()

  if (error || !data) {
    // Try fuzzy match with ilike
    const { data: fuzzy } = await supabase
      .from('entities')
      .select('id')
      .ilike('name', `%${name}%`)
      .limit(1)
      .maybeSingle()

    const id = fuzzy?.id || null
    entityCache.set(normalized, id)
    return id
  }

  entityCache.set(normalized, data.id)
  return data.id
}

async function importRelationshipsCSV(): Promise<number> {
  console.log('\n=== Importing epsteininvestigation.org relationships ===')

  const content = await downloadFile('enrichment/epsteininvestigation-org/csv/relationships.csv')
  if (!content) {
    console.log('No relationships CSV found. Trying JSONL...')
    return await importRelationshipsJSONL()
  }

  const lines = content.trim().split('\n')
  if (lines.length < 2) {
    console.log('Empty CSV')
    return 0
  }

  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase())
  console.log(`CSV headers: ${headers.join(', ')}`)
  console.log(`${lines.length - 1} rows`)

  let imported = 0
  let skipped = 0
  let failed = 0

  for (let i = 1; i < lines.length; i++) {
    try {
      const values = parseCSVLine(lines[i])
      const row: Record<string, string> = {}
      headers.forEach((h, idx) => { row[h] = values[idx] || '' })

      // Try various column name patterns
      const entityAName = row.entity_a || row.source || row.from || row.person_a || row.name_a || ''
      const entityBName = row.entity_b || row.target || row.to || row.person_b || row.name_b || ''
      const rawRelType = row.type || row.relationship_type || row.relationship || row.relation || 'associated'
      const relType = mapRelationshipType(rawRelType)
      const strength = parseFloat(row.strength || row.weight || '0.5')
      const description = row.description || row.details || row.notes || ''

      if (!entityAName || !entityBName) {
        skipped++
        continue
      }

      if (!relType) {
        // CSV parse artifact — type column contains a name
        skipped++
        continue
      }

      const entityAId = await resolveEntityId(entityAName)
      const entityBId = await resolveEntityId(entityBName)

      if (!entityAId) {
        if (i <= 5) console.log(`  Could not resolve entity: "${entityAName}"`)
        skipped++
        continue
      }
      if (!entityBId) {
        if (i <= 5) console.log(`  Could not resolve entity: "${entityBName}"`)
        skipped++
        continue
      }
      if (entityAId === entityBId) {
        skipped++
        continue
      }

      const { error } = await supabase
        .from('entity_relationships')
        .upsert({
          entity_a_id: entityAId,
          entity_b_id: entityBId,
          relationship_type: relType,
          description: description || null,
          strength: isNaN(strength) ? 0.5 : Math.min(1, Math.max(0, strength)),
          metadata: {
            source: 'epsteininvestigation.org',
            original_names: { a: entityAName, b: entityBName },
          },
        }, {
          onConflict: 'entity_a_id,entity_b_id,relationship_type',
        })

      if (error) {
        if (!error.message.includes('duplicate') && !error.message.includes('no_self_relationship')) {
          console.error(`  Row ${i}: ${error.message}`)
        }
        failed++
        continue
      }

      imported++
      if (imported % 100 === 0) {
        console.log(`  Imported ${imported} relationships...`)
      }
    } catch (err) {
      console.error(`  Error on row ${i}:`, err)
      failed++
    }
  }

  return imported
}

async function importRelationshipsJSONL(): Promise<number> {
  const content = await downloadFile('enrichment/epsteininvestigation-org/relationships.jsonl')
  if (!content) {
    console.log('No relationships JSONL found either.')
    return 0
  }

  const lines = content.trim().split('\n')
  let imported = 0

  for (const line of lines) {
    try {
      const data = JSON.parse(line)
      const entityAId = await resolveEntityId(data.entity_a || data.source || '')
      const entityBId = await resolveEntityId(data.entity_b || data.target || '')

      if (!entityAId || !entityBId || entityAId === entityBId) continue

      const jsonRelType = mapRelationshipType(data.type || data.relationship_type || 'associate')
      if (!jsonRelType) continue

      const { error } = await supabase
        .from('entity_relationships')
        .upsert({
          entity_a_id: entityAId,
          entity_b_id: entityBId,
          relationship_type: jsonRelType,
          description: data.description || null,
          strength: data.strength || 0.5,
          metadata: { source: 'epsteininvestigation.org' },
        }, {
          onConflict: 'entity_a_id,entity_b_id,relationship_type',
        })

      if (!error) imported++
    } catch {
      // skip malformed lines
    }
  }

  return imported
}

async function importFlightsAsRelationships(): Promise<number> {
  console.log('\n=== Building co-flight relationships from flights table ===')

  // Fetch all flights with passengers
  const { data: flights, error } = await supabase
    .from('flights')
    .select('id, flight_date, passenger_names')
    .not('passenger_names', 'is', null)
    .order('flight_date', { ascending: true })

  if (error || !flights) {
    console.error('Error fetching flights:', error?.message)
    return 0
  }

  console.log(`Found ${flights.length} flights with passenger lists`)
  let relationships = 0

  for (const flight of flights) {
    const passengers = (flight as any).passenger_names as string[]
    if (!passengers || passengers.length < 2) continue

    // Resolve all passenger entity IDs
    const resolved: { name: string; id: string }[] = []
    for (const name of passengers) {
      const id = await resolveEntityId(name)
      if (id) resolved.push({ name, id })
    }

    // Create pairwise co-flight relationships
    for (let i = 0; i < resolved.length; i++) {
      for (let j = i + 1; j < resolved.length; j++) {
        if (resolved[i].id === resolved[j].id) continue

        // Normalize order (smaller UUID first) for dedup
        const [a, b] = resolved[i].id < resolved[j].id
          ? [resolved[i], resolved[j]]
          : [resolved[j], resolved[i]]

        const { error: relError } = await supabase
          .from('entity_relationships')
          .upsert({
            entity_a_id: a.id,
            entity_b_id: b.id,
            relationship_type: 'traveled_with',
            description: `Co-passengers on flight ${(flight as any).flight_date || 'unknown date'}`,
            strength: 0.8,
            metadata: {
              source: 'flights',
              flight_id: (flight as any).id,
              flight_date: (flight as any).flight_date,
            },
          }, {
            onConflict: 'entity_a_id,entity_b_id,relationship_type',
          })

        if (!relError) relationships++
      }
    }
  }

  return relationships
}

async function main(): Promise<void> {
  console.log('=== Relationship Import ===\n')

  // Check for existing relationships
  const { count } = await supabase
    .from('entity_relationships')
    .select('id', { count: 'exact', head: true })

  console.log(`Existing relationships: ${count || 0}`)

  const csvCount = await importRelationshipsCSV()
  const flightCount = await importFlightsAsRelationships()

  // Final count
  const { count: finalCount } = await supabase
    .from('entity_relationships')
    .select('id', { count: 'exact', head: true })

  console.log('\n=== Import Summary ===')
  console.log(`From epsteininvestigation.org CSV: ${csvCount}`)
  console.log(`From co-flight analysis: ${flightCount}`)
  console.log(`Total relationships in database: ${finalCount}`)
}

main().catch(console.error)

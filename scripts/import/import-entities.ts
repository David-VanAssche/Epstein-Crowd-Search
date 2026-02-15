import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import Database from 'better-sqlite3'
import { writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

function normalizeEntityName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Parse a CSV line respecting quoted fields that may contain commas */
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

async function listFiles(prefix: string): Promise<string[]> {
  const { data, error } = await supabase.storage
    .from('raw-archive')
    .list(prefix, { limit: 10000 })

  if (error) {
    console.error(`Error listing ${prefix}:`, error)
    return []
  }

  return data.map(f => `${prefix}/${f.name}`)
}

async function downloadBlob(path: string): Promise<Blob | null> {
  const { data, error } = await supabase.storage
    .from('raw-archive')
    .download(path)

  if (error) {
    console.error(`Error downloading ${path}:`, error)
    return null
  }

  return data
}

async function upsertEntity(
  name: string,
  entityType: string,
  source: string,
  extra: Record<string, unknown> = {}
): Promise<boolean> {
  const nameNormalized = normalizeEntityName(name)
  if (!nameNormalized || nameNormalized.length <= 1) return false

  // Check if exists
  const { data: existing } = await supabase
    .from('entities')
    .select('id, metadata, aliases, mention_count')
    .eq('name_normalized', nameNormalized)
    .eq('entity_type', entityType)
    .maybeSingle()

  if (existing) {
    // Merge sources
    const existingMeta = (existing.metadata as Record<string, unknown>) || {}
    const existingSources = (existingMeta.sources as string[]) || []
    const sources = Array.from(new Set([...existingSources, source]))
    const aliases = Array.from(new Set([
      ...((existing.aliases as string[]) || []),
      ...((extra.aliases as string[]) || []),
    ]))

    await supabase
      .from('entities')
      .update({
        source: sources.join(','),
        metadata: { ...existingMeta, sources },
        aliases,
        mention_count: ((existing.mention_count as number) || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)

    return true
  }

  // Insert new
  const { error } = await supabase
    .from('entities')
    .insert({
      name,
      name_normalized: nameNormalized,
      entity_type: entityType,
      aliases: (extra.aliases as string[]) || [],
      description: (extra.description as string) || null,
      mention_count: 1,
      document_count: (extra.document_count as number) || 0,
      source,
      metadata: { sources: [source], ...(extra.metadata as Record<string, unknown> || {}) },
    })

  if (error) {
    // Ignore unique constraint violations (race condition between check and insert)
    if (!error.message.includes('duplicate') && !error.message.includes('unique')) {
      console.error(`Error inserting entity ${name}:`, error.message)
    }
    return false
  }

  return true
}

async function importEpsteinInvestigationOrg(): Promise<number> {
  console.log('\n=== Importing epsteininvestigation.org entities ===')
  let count = 0

  // Try JSONL first
  const jsonlBlob = await downloadBlob('enrichment/epsteininvestigation-org/entities_full.jsonl')
  if (jsonlBlob) {
    const text = await jsonlBlob.text()
    const lines = text.trim().split('\n')

    for (const line of lines) {
      try {
        const data = JSON.parse(line)
        const entityType = data.type === 'PERSON' ? 'person' :
          data.type === 'ORG' ? 'organization' :
          data.type === 'GPE' ? 'location' : 'person'

        if (await upsertEntity(data.name, entityType, 'epsteininvestigation.org', {
          description: data.description,
          document_count: data.document_count || 0,
          metadata: { flight_count: data.flight_count, email_count: data.email_count },
        })) {
          count++
        }
      } catch {
        // skip malformed lines
      }
    }

    console.log(`Imported ${count} entities from entities_full.jsonl`)
    return count
  }

  // Fallback to CSV
  const csvBlob = await downloadBlob('enrichment/epsteininvestigation-org/csv/entities.csv')
  if (!csvBlob) {
    console.log('No entities file found')
    return 0
  }

  const csvText = await csvBlob.text()
  const lines = csvText.trim().split('\n')
  const headers = parseCSVLine(lines[0])

  for (let i = 1; i < lines.length; i++) {
    try {
      const values = parseCSVLine(lines[i])
      const row: Record<string, string> = {}
      headers.forEach((h, idx) => { row[h] = values[idx] || '' })

      const name = row.name || row.Name
      if (!name) continue

      if (await upsertEntity(name, (row.type || 'person').toLowerCase(), 'epsteininvestigation.org', {
        description: row.description,
        document_count: parseInt(row.document_count || '0'),
      })) {
        count++
      }
    } catch (err) {
      console.error(`Skipping malformed CSV row ${i}:`, err)
    }
  }

  console.log(`Imported ${count} entities from CSV`)
  return count
}

async function importEpsteinDocs(): Promise<number> {
  console.log('\n=== Importing github/epstein-docs entities ===')
  const files = await listFiles('github/epstein-docs')
  const entityFiles = files.filter(f =>
    f.endsWith('.json') && (
      f.includes('entities') || f.includes('people') ||
      f.includes('persons') || f.includes('organizations')
    )
  )

  let count = 0

  for (const file of entityFiles) {
    console.log(`Processing ${file}`)
    const blob = await downloadBlob(file)
    if (!blob) continue

    try {
      const text = await blob.text()
      const data = JSON.parse(text)
      const entities = Array.isArray(data) ? data : [data]

      for (const item of entities) {
        const name = item.name || item.full_name || item.displayName
        if (!name) continue

        if (await upsertEntity(name, item.type?.toLowerCase() || 'person', 'epstein-docs', {
          aliases: item.aliases || [],
          description: item.description || item.bio,
        })) {
          count++
        }
      }
    } catch (e) {
      console.error(`Error parsing ${file}:`, e)
    }
  }

  console.log(`Imported ${count} entities from epstein-docs`)
  return count
}

async function importLmsband(): Promise<number> {
  console.log('\n=== Importing github/lmsband entities ===')
  const files = await listFiles('github/lmsband')
  const dbFiles = files.filter(f => f.endsWith('.db') || f.endsWith('.sqlite'))

  let count = 0

  for (const file of dbFiles) {
    console.log(`Processing ${file}`)
    const blob = await downloadBlob(file)
    if (!blob) continue

    const tempPath = join('/tmp', `import-lmsband-${Date.now()}.db`)

    try {
      const buffer = Buffer.from(await blob.arrayBuffer())
      writeFileSync(tempPath, buffer)

      const db = new Database(tempPath, { readonly: true })
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]

      const entityTables = tables.filter(t =>
        t.name.toLowerCase().includes('entit') ||
        t.name.toLowerCase().includes('person') ||
        t.name.toLowerCase().includes('organization')
      )

      for (const table of entityTables) {
        try {
          const rows = db.prepare(`SELECT * FROM "${table.name}"`).all() as Record<string, unknown>[]

          for (const row of rows) {
            const name = (row.name || row.entity_name || row.full_name || row.text) as string
            if (!name) continue

            if (await upsertEntity(name, ((row.type || row.entity_type || 'person') as string).toLowerCase(), 'lmsband', {
              mention_count: (row.mention_count || row.count || 0) as number,
            })) {
              count++
            }
          }
        } catch (e) {
          console.error(`Error reading table ${table.name}:`, e)
        }
      }

      db.close()
      unlinkSync(tempPath)
    } catch (e) {
      console.error(`Error processing ${file}:`, e)
      try { unlinkSync(tempPath) } catch { /* ignore */ }
    }
  }

  console.log(`Imported ${count} entities from lmsband`)
  return count
}

async function main() {
  console.log('Starting entity import...\n')

  const stats = {
    epsteininvestigation: await importEpsteinInvestigationOrg(),
    epsteinDocs: await importEpsteinDocs(),
    lmsband: await importLmsband(),
  }

  const total = Object.values(stats).reduce((a, b) => a + b, 0)

  console.log('\n=== Import Summary ===')
  console.log(`epsteininvestigation.org: ${stats.epsteininvestigation}`)
  console.log(`epstein-docs: ${stats.epsteinDocs}`)
  console.log(`lmsband: ${stats.lmsband}`)
  console.log(`Total entities processed: ${total}`)

  const { count: uniqueCount } = await supabase
    .from('entities')
    .select('*', { count: 'exact', head: true })

  console.log(`Unique entities in database: ${uniqueCount}`)
}

main().catch(console.error)

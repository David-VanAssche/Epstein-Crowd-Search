import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

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

async function listStorageFiles(path: string): Promise<string[]> {
  const { data, error } = await supabase.storage.from('raw-archive').list(path, {
    limit: 10000,
    sortBy: { column: 'name', order: 'asc' },
  })

  if (error) {
    console.error(`Error listing ${path}:`, error)
    return []
  }

  return data?.map(f => `${path}/${f.name}`).filter(f => !f.endsWith('/')) || []
}

async function downloadFile(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from('raw-archive').download(path)

  if (error) {
    console.error(`Error downloading ${path}:`, error)
    return null
  }

  return await data.text()
}

async function batchInsert(table: string, records: Record<string, unknown>[], batchSize = 500): Promise<number> {
  let inserted = 0

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize)
    const { error } = await supabase.from(table).insert(batch)

    if (error) {
      console.error(`Error inserting batch into ${table}:`, error.message)
      continue
    }

    inserted += batch.length
    console.log(`  Inserted ${inserted}/${records.length} into ${table}`)
  }

  return inserted
}

async function importBlackbook(): Promise<void> {
  console.log('\n=== Importing Black Book ===')

  const files = await listStorageFiles('websites/blackbook')
  console.log(`Found ${files.length} files`)

  const entities: Record<string, unknown>[] = []

  for (const file of files) {
    console.log(`Processing ${file}`)
    const content = await downloadFile(file)
    if (!content) continue

    try {
      if (file.endsWith('.json')) {
        const parsed = JSON.parse(content)
        const entries = Array.isArray(parsed) ? parsed : [parsed]

        for (const entry of entries) {
          const name = entry.name || entry.full_name
          if (!name) continue

          entities.push({
            name,
            name_normalized: normalizeEntityName(name),
            entity_type: 'person',
            source: 'blackbook',
            metadata: {
              source: 'blackbook',
              phones: entry.phones || entry.phone ? [entry.phone] : [],
              addresses: entry.addresses || entry.address ? [entry.address] : [],
              emails: entry.emails || entry.email ? [entry.email] : [],
            },
          })
        }
      } else if (file.endsWith('.csv')) {
        const lines = content.split('\n').filter(l => l.trim())
        if (lines.length < 2) continue

        const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase())

        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i])
          const row: Record<string, string> = {}
          headers.forEach((h, idx) => { row[h] = values[idx] || '' })

          const name = row.name || row.full_name
          if (!name) continue

          const metadata: Record<string, unknown> = { source: 'blackbook' }
          for (const [k, v] of Object.entries(row)) {
            if (k !== 'name' && v) metadata[k] = v
          }

          entities.push({
            name,
            name_normalized: normalizeEntityName(name),
            entity_type: 'person',
            source: 'blackbook',
            metadata,
          })
        }
      }
    } catch (err) {
      console.error(`  Failed to parse ${file}:`, err)
    }
  }

  if (entities.length > 0) {
    console.log(`\nInserting ${entities.length} entities from blackbook...`)
    await batchInsert('entities', entities)
  }
}

async function importFlights(): Promise<void> {
  console.log('\n=== Importing Flight Records ===')

  const files = await listStorageFiles('websites/archive-org-flights')
  console.log(`Found ${files.length} files`)

  const flights: Record<string, unknown>[] = []

  for (const file of files) {
    console.log(`Processing ${file}`)
    const content = await downloadFile(file)
    if (!content) continue

    try {
      if (file.endsWith('.json')) {
        const parsed = JSON.parse(content)
        const records = Array.isArray(parsed) ? parsed : [parsed]

        for (const record of records) {
          flights.push({
            flight_date: record.flight_date || record.date,
            departure: record.departure_airport || record.departure || record.from,
            arrival: record.arrival_airport || record.arrival || record.to,
            tail_number: record.aircraft_tail_number || record.tail_number,
            aircraft: record.aircraft,
            pilot: record.pilot_name || record.pilot,
            passenger_names: record.passengers || [],
            source: 'archive_org',
          })
        }
      } else {
        // Parse text-format flight logs
        const lines = content.split('\n').filter(l => l.trim())

        for (const line of lines) {
          // Skip headers
          if (line.toLowerCase().includes('date') && line.toLowerCase().includes('from')) continue

          const parts = line.split(/[\t,|]/).map(p => p.trim())
          if (parts.length < 2) continue

          const flight: Record<string, unknown> = {
            source: 'archive_org',
            raw_text: line,
          }

          // Parse date
          const dateMatch = parts[0].match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/)
          if (dateMatch) {
            const [month, day, year] = dateMatch[1].split(/[\/\-]/)
            const fullYear = year.length === 2 ? `20${year}` : year
            flight.flight_date = `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
          }

          // Extract airports (3-letter codes)
          const airports = parts.filter(p => /^[A-Z]{3}$/.test(p))
          if (airports.length >= 2) {
            flight.departure = airports[0]
            flight.arrival = airports[1]
          }

          // Extract tail number
          const tailMatch = line.match(/\b(N\d+[A-Z]*)\b/)
          if (tailMatch) flight.tail_number = tailMatch[1]

          if (flight.flight_date) flights.push(flight)
        }
      }
    } catch (err) {
      console.error(`  Failed to parse ${file}:`, err)
    }
  }

  if (flights.length > 0) {
    console.log(`\nInserting ${flights.length} flight records...`)
    await batchInsert('flights', flights)
  }
}

async function importEmails(): Promise<void> {
  console.log('\n=== Importing Emails ===')

  const files = await listStorageFiles('huggingface/muneeb-emails')
  console.log(`Found ${files.length} files`)

  const emails: Record<string, unknown>[] = []

  for (const file of files) {
    const content = await downloadFile(file)
    if (!content) continue

    try {
      if (file.endsWith('.json') || file.endsWith('.jsonl')) {
        const lines = content.trim().split('\n')
        for (const line of lines) {
          try {
            const record = JSON.parse(line)
            emails.push({
              from_raw: record.from_address || record.from,
              to_raw: record.to_addresses || (record.to ? [record.to] : []),
              cc_raw: record.cc_addresses || [],
              bcc_raw: record.bcc_addresses || [],
              subject: record.subject,
              body: record.body || record.text,
              sent_date: record.sent_at || record.date,
              message_id: record.message_id,
              thread_id: record.thread_id,
              in_reply_to: record.in_reply_to,
              metadata: { source: 'muneeb-emails', source_file: file },
            })
          } catch { /* skip malformed lines */ }
        }
      } else {
        // Parse RFC 822 style email
        const emailData: Record<string, unknown> = {
          metadata: { source: 'muneeb-emails', source_file: file },
        }
        const lines = content.split('\n')
        let inBody = false
        let body = ''

        for (const line of lines) {
          if (inBody) { body += line + '\n'; continue }
          if (line.trim() === '') { inBody = true; continue }

          const colonIdx = line.indexOf(':')
          if (colonIdx === -1) continue

          const key = line.slice(0, colonIdx).toLowerCase().trim()
          const value = line.slice(colonIdx + 1).trim()

          switch (key) {
            case 'from': emailData.from_raw = value; break
            case 'to': emailData.to_raw = value.split(',').map(v => v.trim()); break
            case 'cc': emailData.cc_raw = value.split(',').map(v => v.trim()); break
            case 'subject': emailData.subject = value; break
            case 'date':
              try { emailData.sent_date = new Date(value).toISOString() } catch { /* skip */ }
              break
            case 'message-id': emailData.message_id = value; break
            case 'in-reply-to': emailData.in_reply_to = value; break
          }
        }

        if (body.trim()) emailData.body = body.trim()
        if (emailData.from_raw || emailData.subject) emails.push(emailData)
      }
    } catch (err) {
      console.error(`  Failed to parse ${file}:`, err)
    }
  }

  if (emails.length > 0) {
    // NOTE: The emails table requires document_id NOT NULL. Community-sourced
    // emails (muneeb dataset) are standalone and don't have document references.
    // We store them in structured_data_extractions instead, which allows us to
    // link them to documents later when we match them during the pipeline.
    console.log(`\nStoring ${emails.length} community emails as structured extractions...`)
    const extractions = emails.map(email => ({
      document_id: null as unknown, // Will fail if table enforces NOT NULL
      extraction_type: 'email',
      extracted_data: email,
      confidence: 0.8,
    }))

    // Try structured_data_extractions first; if document_id is required there too,
    // just log the count for future processing
    const { error } = await supabase.from('structured_data_extractions').insert(extractions.slice(0, 1))
    if (error) {
      console.warn(`Cannot insert standalone emails (document_id required): ${error.message}`)
      console.log(`${emails.length} emails parsed and ready for import after document seeding`)
    } else {
      // First one worked, insert the rest
      await batchInsert('structured_data_extractions', extractions.slice(1))
    }
  }
}

async function importEpsteinExposed(): Promise<void> {
  console.log('\n=== Importing Epstein Exposed Data ===')

  const files = await listStorageFiles('websites/epstein-exposed')
  console.log(`Found ${files.length} files`)

  // Sample first files to understand structure
  const sampleSize = Math.min(5, files.length)
  for (let i = 0; i < sampleSize; i++) {
    const content = await downloadFile(files[i])
    if (!content) continue
    console.log(`Sample ${i + 1}: ${files[i]} (${content.length} bytes)`)
    console.log(`  Preview: ${content.substring(0, 200)}...`)
  }

  const flights: Record<string, unknown>[] = []
  const entities: Record<string, unknown>[] = []

  for (const file of files) {
    const content = await downloadFile(file)
    if (!content) continue

    try {
      const data = JSON.parse(content)
      const records = Array.isArray(data) ? data : [data]

      for (const record of records) {
        if (record.flight_date || record.date) {
          flights.push({
            flight_date: record.flight_date || record.date,
            departure: record.departure || record.from,
            arrival: record.arrival || record.to,
            tail_number: record.tail_number,
            aircraft: record.aircraft,
            passenger_names: record.passengers || record.manifest || [],
            source: 'epstein_exposed',
          })
        }

        if (record.name || record.person) {
          const name = record.name || record.person
          entities.push({
            name,
            name_normalized: normalizeEntityName(name),
            entity_type: record.entity_type || 'person',
            source: 'epstein-exposed',
            metadata: {
              source: 'epstein-exposed',
              ...(record.location && { location: record.location }),
              ...(record.gps && { gps: record.gps }),
            },
          })
        }
      }
    } catch {
      // Not JSON — skip
    }
  }

  if (flights.length > 0) {
    console.log(`\nInserting ${flights.length} flight records from epstein-exposed...`)
    await batchInsert('flights', flights)
  }

  if (entities.length > 0) {
    console.log(`\nInserting ${entities.length} entities from epstein-exposed...`)
    await batchInsert('entities', entities)
  }
}

async function main(): Promise<void> {
  console.log('Starting structured data import...\n')

  await importBlackbook()
  await importFlights()
  await importEmails()
  await importEpsteinExposed()

  console.log('\n=== Import Complete ===')
}

main().catch(console.error)

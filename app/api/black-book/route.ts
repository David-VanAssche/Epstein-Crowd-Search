// app/api/black-book/route.ts
// Queries entities with blackbook source metadata for the Black Book Browser.
// Falls back to structured_data_extractions for pipeline-extracted entries.
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { paginated, handleApiError } from '@/lib/api/responses'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const rawSearch = url.searchParams.get('search') || ''
    const search = rawSearch.trim().slice(0, 200).replace(/[%_]/g, '')
    const letter = url.searchParams.get('letter') || ''
    const page = Math.max(parseInt(url.searchParams.get('page') || '1', 10) || 1, 1)
    const perPage = Math.min(Math.max(parseInt(url.searchParams.get('per_page') || '100', 10) || 100, 1), 100)
    const offset = (page - 1) * perPage

    const supabase = await createClient()

    // Query 1: Entities with blackbook metadata (from community import)
    let entityQuery = supabase
      .from('entities')
      .select('id, name, entity_type, risk_score, metadata', { count: 'exact' })
      .eq('metadata->>source', 'blackbook')
      .order('name', { ascending: true })
      .range(offset, offset + perPage - 1)

    if (search.length > 0) {
      entityQuery = entityQuery.ilike('name', `%${search}%`)
    }
    if (letter && /^[A-Z]$/i.test(letter)) {
      entityQuery = entityQuery.ilike('name', `${letter.toUpperCase()}%`)
    }

    const { data: entities, count: entityCount, error: entityError } = await entityQuery

    if (entityError) {
      console.warn(`[BlackBook] Entity query failed: ${entityError.message}`)
    }

    // Query 2: structured_data_extractions for pipeline-extracted entries
    let extractionQuery = supabase
      .from('structured_data_extractions')
      .select('id, document_id, extracted_data, created_at', { count: 'exact' })
      .eq('extraction_type', 'address_book_entry')
      .order('created_at', { ascending: true })

    if (search.length > 0) {
      extractionQuery = extractionQuery.ilike('extracted_data->>name', `%${search}%`)
    }
    if (letter && /^[A-Z]$/i.test(letter)) {
      extractionQuery = extractionQuery.ilike('extracted_data->>name', `${letter.toUpperCase()}%`)
    }

    const { data: extractions, count: extractionCount } = await extractionQuery

    // Merge results: entities first, then extractions (deduplicated by name)
    const seenNames = new Set<string>()
    const results: any[] = []

    // Add entity-sourced entries
    for (const entity of entities || []) {
      const meta = (entity.metadata || {}) as Record<string, any>
      seenNames.add(entity.name.toLowerCase())
      results.push({
        id: entity.id,
        document_id: null,
        name: entity.name,
        phones: meta.phones || [],
        addresses: meta.addresses || [],
        emails: meta.emails || [],
        relationships: meta.relationships || [],
        notes: meta.notes || null,
        linked_entity: {
          id: entity.id,
          entity_type: entity.entity_type,
          risk_score: entity.risk_score || 0,
        },
      })
    }

    // Add extraction-sourced entries (pipeline), deduplicated
    for (const ext of extractions || []) {
      const name = ext.extracted_data?.name || ''
      if (seenNames.has(name.toLowerCase())) continue
      seenNames.add(name.toLowerCase())
      results.push({
        id: ext.id,
        document_id: ext.document_id,
        name,
        phones: ext.extracted_data?.phones || [],
        addresses: ext.extracted_data?.addresses || [],
        emails: ext.extracted_data?.emails || [],
        relationships: ext.extracted_data?.relationships || [],
        notes: ext.extracted_data?.notes || null,
        linked_entity: null,
      })
    }

    const totalCount = (entityCount || 0) + (extractionCount || 0)
    return paginated(results, page, perPage, totalCount)
  } catch (err) {
    return handleApiError(err)
  }
}

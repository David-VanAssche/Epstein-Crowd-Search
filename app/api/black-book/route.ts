// app/api/black-book/route.ts
// Queries address_book_entry extractions for the Black Book Browser.
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

    let query = supabase
      .from('structured_data_extractions')
      .select('id, document_id, extracted_data, created_at', { count: 'exact' })
      .eq('extraction_type', 'address_book_entry')
      .order('created_at', { ascending: true })
      .range(offset, offset + perPage - 1)

    // Text search on name within extracted_data JSONB (sanitized above)
    if (search.length > 0) {
      query = query.ilike('extracted_data->>name', `%${search}%`)
    }

    // Alphabet filter
    if (letter && /^[A-Z]$/i.test(letter)) {
      query = query.ilike('extracted_data->>name', `${letter.toUpperCase()}%`)
    }

    const { data: entries, count, error } = await query

    if (error) {
      throw new Error(`Black book query failed: ${error.message}`)
    }

    // Entity linking: try to match names to entities
    const names = (entries || [])
      .map((e: any) => e.extracted_data?.name)
      .filter(Boolean)

    let entityMap = new Map<string, { id: string; entity_type: string; risk_score: number }>()

    if (names.length > 0) {
      const { data: matchedEntities, error: matchError } = await supabase
        .from('entities')
        .select('id, name, name_normalized, entity_type, risk_score')
        .in('name', names)

      if (matchError) {
        console.warn(`[BlackBook] Entity matching failed: ${matchError.message}`)
      }

      if (matchedEntities) {
        for (const e of matchedEntities as any[]) {
          entityMap.set(e.name, { id: e.id, entity_type: e.entity_type, risk_score: e.risk_score || 0 })
        }
      }
    }

    // Enrich entries with entity links
    const enriched = (entries || []).map((entry: any) => {
      const name = entry.extracted_data?.name || ''
      const linked = entityMap.get(name)
      return {
        id: entry.id,
        document_id: entry.document_id,
        name,
        phones: entry.extracted_data?.phones || [],
        addresses: entry.extracted_data?.addresses || [],
        relationships: entry.extracted_data?.relationships || [],
        notes: entry.extracted_data?.notes || null,
        linked_entity: linked || null,
      }
    })

    return paginated(enriched, page, perPage, count || 0)
  } catch (err) {
    return handleApiError(err)
  }
}

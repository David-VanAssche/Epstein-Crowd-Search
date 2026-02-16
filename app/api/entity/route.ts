// app/api/entity/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { paginationSchema, parseSearchParams } from '@/lib/api/schemas'
import { paginated, handleApiError } from '@/lib/api/responses'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const queryParams = parseSearchParams(url)
    const input = paginationSchema.parse(queryParams)
    const typeFilter = url.searchParams.get('type') || null

    const supabase = await createClient()
    const offset = (input.page - 1) * input.per_page

    let query = supabase
      .from('entities')
      .select('id, name, entity_type, mention_count, document_count, risk_score', { count: 'exact' })
      .order('mention_count', { ascending: false })
      .range(offset, offset + input.per_page - 1)

    if (typeFilter) {
      query = query.eq('entity_type', typeFilter)
    }

    const { data: entities, count, error } = await query

    if (error) {
      throw new Error(`Entity list query failed: ${error.message}`)
    }

    return paginated(entities || [], input.page, input.per_page, count || 0)
  } catch (err) {
    return handleApiError(err)
  }
}

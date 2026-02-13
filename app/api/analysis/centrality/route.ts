// app/api/analysis/centrality/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { networkAnalysisSchema, parseSearchParams } from '@/lib/api/schemas'
import { paginated, handleApiError } from '@/lib/api/responses'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const params = parseSearchParams(url)
    const input = networkAnalysisSchema.parse(params)
    const offset = (input.page - 1) * input.per_page

    const supabase = await createClient()

    let query = supabase
      .from('entity_network_metrics')
      .select('*', { count: 'exact' })
      .gt('degree', 0)

    if (input.entity_type) {
      query = query.eq('entity_type', input.entity_type)
    }

    query = query
      .order(input.sort, { ascending: false })
      .range(offset, offset + input.per_page - 1)

    const { data, count, error } = await query

    if (error) throw new Error(`Centrality query failed: ${error.message}`)

    return paginated(data || [], input.page, input.per_page, count || 0)
  } catch (err) {
    return handleApiError(err)
  }
}

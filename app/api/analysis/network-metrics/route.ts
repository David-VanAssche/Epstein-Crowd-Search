// app/api/analysis/network-metrics/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { networkMetricsSchema, parseSearchParams } from '@/lib/api/schemas'
import { paginated, handleApiError } from '@/lib/api/responses'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const params = parseSearchParams(url)
    const input = networkMetricsSchema.parse(params)
    const offset = (input.page - 1) * input.per_page

    const supabase = await createClient()

    let query = supabase
      .from('entity_network_metrics')
      .select('*', { count: 'exact' })
      .gte('degree', input.min_degree)

    if (input.cluster_id !== undefined) {
      query = query.eq('cluster_id', input.cluster_id)
    }

    const ascending = false
    query = query
      .order(input.sort, { ascending })
      .range(offset, offset + input.per_page - 1)

    const { data, count, error } = await query

    if (error) throw new Error(`Network metrics query failed: ${error.message}`)

    return paginated(data || [], input.page, input.per_page, count || 0)
  } catch (err) {
    return handleApiError(err)
  }
}

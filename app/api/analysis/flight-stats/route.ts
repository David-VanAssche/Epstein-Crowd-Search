// app/api/analysis/flight-stats/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { flightStatsSchema, parseSearchParams } from '@/lib/api/schemas'
import { paginated, handleApiError } from '@/lib/api/responses'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const params = parseSearchParams(url)
    const input = flightStatsSchema.parse(params)
    const offset = (input.page - 1) * input.per_page

    const supabase = await createClient()

    const sortColumn = input.sort === 'entity_name' ? 'entity_name' : input.sort
    const ascending = input.sort === 'entity_name'

    const { data, count, error } = await supabase
      .from('flight_passenger_stats')
      .select('*', { count: 'exact' })
      .gte('flight_count', input.min_flights)
      .order(sortColumn, { ascending })
      .range(offset, offset + input.per_page - 1)

    if (error) throw new Error(`Flight stats query failed: ${error.message}`)

    return paginated(data || [], input.page, input.per_page, count || 0)
  } catch (err) {
    return handleApiError(err)
  }
}

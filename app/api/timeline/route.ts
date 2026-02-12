// app/api/timeline/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { timelineQuerySchema, parseSearchParams } from '@/lib/api/schemas'
import { paginated, handleApiError } from '@/lib/api/responses'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const queryParams = parseSearchParams(url)
    const input = timelineQuerySchema.parse(queryParams)

    const supabase = await createClient()
    const offset = (input.page - 1) * input.per_page

    let query = supabase
      .from('timeline_events')
      .select('*', { count: 'exact' })
      .order('event_date', { ascending: true, nullsFirst: false })
      .range(offset, offset + input.per_page - 1)

    if (input.entity_id) {
      query = query.contains('entity_ids', [input.entity_id])
    }
    if (input.date_from) {
      query = query.gte('event_date', input.date_from)
    }
    if (input.date_to) {
      query = query.lte('event_date', input.date_to)
    }
    if (input.event_type) {
      query = query.eq('event_type', input.event_type)
    }

    const { data: events, count, error } = await query

    if (error) {
      throw new Error(`Timeline query failed: ${error.message}`)
    }

    return paginated(events || [], input.page, input.per_page, count || 0)
  } catch (err) {
    return handleApiError(err)
  }
}

// app/api/timeline/route.ts
// Returns timeline events. When timeline_events is empty, synthesizes events from flights.
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

    // Check if timeline_events has data
    const { count: timelineCount } = await supabase
      .from('timeline_events')
      .select('*', { count: 'exact', head: true })

    if (timelineCount && timelineCount > 0) {
      // Use real timeline_events
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
    }

    // Fallback: synthesize timeline from flights table
    let flightQuery = supabase
      .from('flights')
      .select('id, flight_date, departure, arrival, aircraft, tail_number, passenger_names, source', { count: 'exact' })
      .not('flight_date', 'is', null)
      .order('flight_date', { ascending: true })
      .range(offset, offset + input.per_page - 1)

    if (input.date_from) {
      flightQuery = flightQuery.gte('flight_date', input.date_from)
    }
    if (input.date_to) {
      flightQuery = flightQuery.lte('flight_date', input.date_to)
    }
    if (input.event_type && input.event_type !== 'flight') {
      // No non-flight events available yet
      return paginated([], input.page, input.per_page, 0)
    }

    const { data: flights, count: flightCount, error: flightError } = await flightQuery

    if (flightError) {
      throw new Error(`Flight timeline query failed: ${flightError.message}`)
    }

    // Transform flights into timeline event shape
    const events = (flights || []).map((f: any) => {
      const passengers = (f.passenger_names || []) as string[]
      const route = [f.departure, f.arrival].filter(Boolean).join(' → ')

      return {
        id: f.id,
        event_date: f.flight_date,
        date_precision: 'exact',
        event_type: 'flight',
        description: passengers.length > 0
          ? `Flight ${route || 'unknown route'} with ${passengers.length} passenger(s): ${passengers.slice(0, 5).join(', ')}${passengers.length > 5 ? '...' : ''}`
          : `Flight ${route || 'unknown route'}`,
        location: route || null,
        entity_ids: [],
        source_document_ids: [],
        metadata: {
          aircraft: f.aircraft,
          tail_number: f.tail_number,
          passengers,
          source: f.source,
          synthetic: true,
        },
      }
    })

    return paginated(events, input.page, input.per_page, flightCount || 0)
  } catch (err) {
    return handleApiError(err)
  }
}

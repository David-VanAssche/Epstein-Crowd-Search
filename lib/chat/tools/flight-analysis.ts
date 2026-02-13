// lib/chat/tools/flight-analysis.ts
import type { ChatTool } from '../chat-orchestrator'

export const flightAnalysisTool: ChatTool = {
  name: 'flight_analysis',
  description:
    'Analyze flight records — find flight statistics, passenger lists, frequent flyers, and route patterns.',
  parameters: {
    type: 'object',
    properties: {
      entity_name: { type: 'string', description: 'Name of a person to look up flight stats for' },
      route: { type: 'string', description: 'Route to search (e.g., "Teterboro" or "Palm Beach")' },
      min_flights: { type: 'number', description: 'Minimum number of flights (default 2)' },
      limit: { type: 'number', description: 'Max results (default 20)' },
    },
    required: [],
  },
  execute: async (params, supabase) => {
    const entityName = params.entity_name ? String(params.entity_name) : null
    const limit = Number(params.limit) || 20

    if (entityName) {
      // Look up specific person's flight stats
      const { data: entity } = await supabase.from('entities').select('id, name')
        .ilike('name', `%${entityName}%`).eq('entity_type', 'person')
        .order('mention_count', { ascending: false }).limit(1).single()

      if (!entity) return `Person not found: "${entityName}"`

      const { data: stats } = await supabase
        .from('flight_passenger_stats')
        .select('*')
        .eq('entity_id', (entity as any).id)
        .single()

      if (!stats) return `No flight records found for ${(entity as any).name}`

      const s = stats as any
      return `Flight statistics for ${s.entity_name}:
- Total flights: ${s.flight_count}
- Date range: ${s.first_flight_date || '?'} to ${s.last_flight_date || '?'}
- Most common route: ${s.top_route || 'N/A'}
- Aircraft used: ${(s.aircraft_used || []).join(', ') || 'N/A'}
(entity_id: ${s.entity_id})`
    }

    // General: top flyers
    const minFlights = Number(params.min_flights) || 2
    const { data: topFlyers, error } = await supabase
      .from('flight_passenger_stats')
      .select('entity_id, entity_name, flight_count, top_route, first_flight_date, last_flight_date')
      .gte('flight_count', minFlights)
      .order('flight_count', { ascending: false })
      .limit(limit)

    if (error) return `Flight stats error: ${error.message}`
    if (!topFlyers || topFlyers.length === 0) return 'No flight passenger statistics available yet.'

    return `Top ${topFlyers.length} frequent flyers (min ${minFlights} flights):\n` +
      topFlyers.map((f: any, i: number) =>
        `${i + 1}. ${f.entity_name}: ${f.flight_count} flights (${f.first_flight_date || '?'} - ${f.last_flight_date || '?'})${f.top_route ? ` | Route: ${f.top_route}` : ''}`
      ).join('\n')
  },
}

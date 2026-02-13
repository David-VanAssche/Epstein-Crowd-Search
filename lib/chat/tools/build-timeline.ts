// lib/chat/tools/build-timeline.ts
import type { ChatTool } from '../chat-orchestrator'

export const buildTimelineTool: ChatTool = {
  name: 'build_timeline',
  description: 'Build a chronological timeline of events for an entity or topic.',
  parameters: {
    type: 'object',
    properties: {
      entityName: { type: 'string', description: 'Entity to build timeline for (optional)' },
      dateFrom: { type: 'string', description: 'Start date (ISO format, optional)' },
      dateTo: { type: 'string', description: 'End date (ISO format, optional)' },
    },
  },
  execute: async (params, supabase) => {
    let query = supabase.from('timeline_events').select('*').order('event_date', { ascending: true }).limit(20)

    if (params.entityName) {
      const { data: entity } = await supabase.from('entities').select('id').ilike('name', `%${params.entityName}%`).single()
      if (entity) {
        query = query.contains('entity_ids', [(entity as any).id])
      }
    }

    if (params.dateFrom) query = query.gte('event_date', String(params.dateFrom))
    if (params.dateTo) query = query.lte('event_date', String(params.dateTo))

    const { data: events, error } = await query

    if (error || !events) return `Timeline error: ${error?.message || 'no events'}`
    if (events.length === 0) return 'No timeline events found for the given criteria.'

    return `Timeline (${events.length} events):
${events.map((e: any) => `- ${e.date_display || e.event_date || 'Unknown date'}: ${e.description} [${e.event_type}]${e.location ? ` at ${e.location}` : ''}`).join('\n')}`
  },
}

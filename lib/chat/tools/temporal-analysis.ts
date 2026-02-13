// lib/chat/tools/temporal-analysis.ts
import type { ChatTool } from '../chat-orchestrator'

export const temporalAnalysisTool: ChatTool = {
  name: 'temporal_analysis',
  description:
    'Analyze temporal activity for an entity — find flights, emails, timeline events, and financial transactions within a date window.',
  parameters: {
    type: 'object',
    properties: {
      entity_name: { type: 'string', description: 'Name or UUID of the entity to analyze' },
      window_days: { type: 'number', description: 'Window size in days (default 7)' },
      max_results: { type: 'number', description: 'Max results (default 50)' },
    },
    required: ['entity_name'],
  },
  execute: async (params, supabase) => {
    const entityName = String(params.entity_name)
    const windowDays = Number(params.window_days) || 7
    const maxResults = Number(params.max_results) || 50

    // Resolve entity
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    let entityId: string | null = null

    if (uuidRegex.test(entityName)) {
      entityId = entityName
    } else {
      const { data } = await supabase.from('entities').select('id, name')
        .ilike('name', `%${entityName}%`).order('mention_count', { ascending: false }).limit(1).single()
      entityId = data?.id || null
    }

    if (!entityId) return `Entity not found: "${entityName}"`

    const { data, error } = await supabase.rpc('find_temporal_clusters', {
      target_entity_id: entityId,
      window_days: windowDays,
      max_results: maxResults,
    })

    if (error) return `Temporal analysis error: ${error.message}`
    if (!data || data.length === 0) return `No temporal activity found for "${entityName}" within ${windowDays}-day windows.`

    const byType: Record<string, any[]> = {}
    for (const item of data) {
      const type = item.activity_type
      if (!byType[type]) byType[type] = []
      byType[type].push(item)
    }

    let result = `Temporal activity for entity (${data.length} total activities):\n\n`
    for (const [type, items] of Object.entries(byType)) {
      result += `## ${type} (${items.length})\n`
      for (const item of items.slice(0, 10)) {
        const date = item.activity_date ? new Date(item.activity_date).toLocaleDateString() : 'unknown date'
        result += `- [${date}] ${item.description}\n  (doc_id: ${item.document_id})\n`
      }
      if (items.length > 10) result += `  ... and ${items.length - 10} more\n`
      result += '\n'
    }

    return result
  },
}

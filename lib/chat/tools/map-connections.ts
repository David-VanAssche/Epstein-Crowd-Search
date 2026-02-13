// lib/chat/tools/map-connections.ts
import type { ChatTool } from '../chat-orchestrator'

export const mapConnectionsTool: ChatTool = {
  name: 'map_connections',
  description: 'Map connections between two entities, showing how they are related through the document corpus.',
  parameters: {
    type: 'object',
    properties: {
      entityA: { type: 'string', description: 'First entity name' },
      entityB: { type: 'string', description: 'Second entity name' },
    },
    required: ['entityA', 'entityB'],
  },
  execute: async (params, supabase) => {
    const nameA = String(params.entityA)
    const nameB = String(params.entityB)

    const { data: entA } = await supabase.from('entities').select('id, name').ilike('name', `%${nameA}%`).single()
    const { data: entB } = await supabase.from('entities').select('id, name').ilike('name', `%${nameB}%`).single()

    if (!entA || !entB) return `Could not find one or both entities: "${nameA}", "${nameB}"`

    // Direct relationships
    const { data: direct } = await supabase
      .from('entity_relationships')
      .select('*')
      .or(`and(entity_a_id.eq.${(entA as any).id},entity_b_id.eq.${(entB as any).id}),and(entity_a_id.eq.${(entB as any).id},entity_b_id.eq.${(entA as any).id})`)

    // Co-occurrences (chunks where both appear)
    const { data: mentionsA } = await supabase.from('entity_mentions').select('chunk_id').eq('entity_id', (entA as any).id)
    const { data: mentionsB } = await supabase.from('entity_mentions').select('chunk_id').eq('entity_id', (entB as any).id)

    const chunksA = new Set((mentionsA || []).map((m: any) => m.chunk_id))
    const coOccurrences = (mentionsB || []).filter((m: any) => chunksA.has(m.chunk_id))

    return `Connection analysis: ${(entA as any).name} <-> ${(entB as any).name}

Direct relationships:
${(direct || []).map((r: any) => `- ${r.relationship_type}: ${r.description || 'no description'}`).join('\n') || 'None found'}

Co-occurrences: Mentioned together in ${coOccurrences.length} text chunks`
  },
}

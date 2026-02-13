// lib/chat/tools/find-path.ts
import type { ChatTool } from '../chat-orchestrator'

export const findPathTool: ChatTool = {
  name: 'find_path',
  description:
    'Find the shortest connection path between two entities in the network. Returns the chain of relationships connecting them.',
  parameters: {
    type: 'object',
    properties: {
      source: { type: 'string', description: 'Name or UUID of the source entity' },
      target: { type: 'string', description: 'Name or UUID of the target entity' },
      max_depth: { type: 'number', description: 'Maximum degrees of separation (default 6)' },
    },
    required: ['source', 'target'],
  },
  execute: async (params, supabase) => {
    const source = String(params.source)
    const target = String(params.target)
    const maxDepth = Number(params.max_depth) || 6

    // Resolve entities
    const sourceEntity = await resolveEntity(source, supabase)
    if (!sourceEntity) return `Entity not found: "${source}"`

    const targetEntity = await resolveEntity(target, supabase)
    if (!targetEntity) return `Entity not found: "${target}"`

    const { data: path, error } = await supabase.rpc('find_shortest_path', {
      source_entity_id: sourceEntity.id,
      target_entity_id: targetEntity.id,
      max_depth: maxDepth,
    })

    if (error) return `Path finder error: ${error.message}`
    if (!path || path.length === 0) {
      return `No connection found between ${sourceEntity.name} and ${targetEntity.name} within ${maxDepth} degrees.`
    }

    const steps = path.map((s: any, i: number) =>
      `${i + 1}. ${s.entity_name} (${s.entity_type})${s.relationship_type ? ` —[${s.relationship_type}]→` : ''}`
    ).join('\n')

    return `Connection path (${path.length - 1} degrees of separation):\n${steps}\n\n(entity_ids: ${path.map((s: any) => s.entity_id).join(', ')})`
  },
}

async function resolveEntity(nameOrId: string, supabase: any) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (uuidRegex.test(nameOrId)) {
    const { data } = await supabase.from('entities').select('id, name').eq('id', nameOrId).single()
    return data
  }
  const { data } = await supabase.from('entities').select('id, name')
    .ilike('name', `%${nameOrId}%`).order('mention_count', { ascending: false }).limit(1).single()
  return data
}

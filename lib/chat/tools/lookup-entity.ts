// lib/chat/tools/lookup-entity.ts
import type { ChatTool } from '../chat-orchestrator'

export const lookupEntityTool: ChatTool = {
  name: 'lookup_entity',
  description: 'Look up an entity (person, organization, location) and get all their mentions and relationships.',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Entity name to look up' },
    },
    required: ['name'],
  },
  execute: async (params, supabase) => {
    const name = String(params.name)

    const { data: entities } = await supabase
      .from('entities')
      .select('*')
      .ilike('name', `%${name}%`)
      .limit(5)

    if (!entities || entities.length === 0) return `No entity found matching "${name}"`

    const entity = entities[0] as any
    const { data: mentions } = await supabase
      .from('entity_mentions')
      .select('mention_text, context_snippet, documents(filename)')
      .eq('entity_id', entity.id)
      .limit(10)

    const { data: relationships } = await supabase
      .from('entity_relationships')
      .select('relationship_type, description, entity_b:entities!entity_b_id(name)')
      .eq('entity_a_id', entity.id)
      .limit(10)

    return `Entity: ${entity.name} (${entity.entity_type})
Aliases: ${entity.aliases?.join(', ') || 'none'}
Mentions: ${entity.mention_count} across ${entity.document_count} documents
${entity.description || ''}

Key mentions:
${(mentions || []).map((m: any) => `- "${m.mention_text}" in ${m.documents?.filename || 'unknown'}: ${m.context_snippet || ''}`).join('\n')}

Relationships:
${(relationships || []).map((r: any) => `- ${r.relationship_type} with ${r.entity_b?.name || 'unknown'}: ${r.description || ''}`).join('\n')}`
  },
}

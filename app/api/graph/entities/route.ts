// app/api/graph/entities/route.ts
// Returns top N entities + inter-relationships as { nodes, edges }.
// Optionally BFS from a specific entity.
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseSearchParams } from '@/lib/api/schemas'
import { success, handleApiError } from '@/lib/api/responses'
import { z } from 'zod'

const graphEntitiesSchema = z.object({
  entity: z.string().uuid().optional(), // BFS from this entity
  limit: z.number().int().min(10).max(500).default(100),
  depth: z.number().int().min(1).max(4).default(2),
  min_strength: z.number().min(0).max(10).default(0),
})

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const params = parseSearchParams(url)
    const input = graphEntitiesSchema.parse(params)

    const supabase = await createClient()

    if (input.entity) {
      // BFS from specific entity
      const { data: graphData, error } = await supabase.rpc(
        'get_entity_connection_graph',
        {
          start_entity_id: input.entity,
          max_depth: input.depth,
          max_nodes: input.limit,
        }
      )

      if (error) throw new Error(`Graph query failed: ${error.message}`)

      const rawNodes = (graphData as any[]) || []
      const nodeIds = new Set(rawNodes.map((n) => n.entity_id))

      // Fetch inter-relationships
      const nodes = rawNodes.map((n) => ({
        id: n.entity_id,
        name: n.entity_name,
        entityType: n.entity_type,
        mentionCount: n.mention_count || 0,
        connectionCount: 0,
        documentCount: 0,
        depth: n.depth,
      }))

      const edges = rawNodes
        .filter((n) => n.connected_from !== null)
        .map((n, i) => ({
          id: `edge-${i}`,
          sourceId: n.connected_from,
          targetId: n.entity_id,
          sourceName: '',
          targetName: '',
          relationshipType: n.relationship_type || 'associated_with',
          strength: n.relationship_strength || 1,
          evidenceCount: 0,
        }))

      return success({ nodes, edges })
    }

    // Top N entities by mention count
    const { data: topEntities, error: entityError } = await supabase
      .from('entities')
      .select('id, name, entity_type, mention_count, document_count')
      .order('mention_count', { ascending: false })
      .limit(input.limit)

    if (entityError) throw new Error(`Entity query failed: ${entityError.message}`)
    if (!topEntities || topEntities.length === 0) return success({ nodes: [], edges: [] })

    const entityIds = topEntities.map((e: any) => e.id)
    const entityMap = new Map(topEntities.map((e: any) => [e.id, e]))

    // Get relationships between these entities
    const { data: relationships, error: relError } = await supabase
      .from('entity_relationships')
      .select('id, entity_a_id, entity_b_id, relationship_type, strength, evidence_document_ids, description')
      .or(`entity_a_id.in.(${entityIds.join(',')}),entity_b_id.in.(${entityIds.join(',')})`)
      .gte('strength', input.min_strength)
      .order('strength', { ascending: false })
      .limit(500)

    if (relError) throw new Error(`Relationship query failed: ${relError.message}`)

    const nodes = topEntities.map((e: any) => ({
      id: e.id,
      name: e.name,
      entityType: e.entity_type,
      mentionCount: e.mention_count || 0,
      connectionCount: 0,
      documentCount: e.document_count || 0,
    }))

    const edges = (relationships || [])
      .filter((r: any) => entityMap.has(r.entity_a_id) && entityMap.has(r.entity_b_id))
      .map((r: any) => ({
        id: r.id,
        sourceId: r.entity_a_id,
        targetId: r.entity_b_id,
        sourceName: entityMap.get(r.entity_a_id)?.name || '',
        targetName: entityMap.get(r.entity_b_id)?.name || '',
        relationshipType: r.relationship_type,
        strength: r.strength || 1,
        evidenceCount: (r.evidence_document_ids || []).length,
        description: r.description,
      }))

    // Update connection counts
    const connectionCounts = new Map<string, number>()
    for (const edge of edges) {
      connectionCounts.set(edge.sourceId, (connectionCounts.get(edge.sourceId) || 0) + 1)
      connectionCounts.set(edge.targetId, (connectionCounts.get(edge.targetId) || 0) + 1)
    }
    for (const node of nodes) {
      node.connectionCount = connectionCounts.get(node.id) || 0
    }

    return success({ nodes, edges })
  } catch (err) {
    return handleApiError(err)
  }
}

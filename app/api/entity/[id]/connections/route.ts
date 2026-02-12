// app/api/entity/[id]/connections/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { entityConnectionsSchema, parseSearchParams } from '@/lib/api/schemas'
import { success, notFound, handleApiError } from '@/lib/api/responses'
import type { EntityConnectionNode } from '@/types/entities'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const url = new URL(request.url)
    const queryParams = parseSearchParams(url)
    const input = entityConnectionsSchema.parse(queryParams)

    const supabase = await createClient()

    // Verify entity exists
    const { data: entity, error: entityError } = await supabase
      .from('entities')
      .select('id')
      .eq('id', id)
      .single()

    if (entityError || !entity) {
      return notFound('Entity not found')
    }

    // Fetch the connection graph via RPC
    const { data: graphData, error: graphError } = await supabase.rpc(
      'get_entity_connection_graph',
      {
        start_entity_id: id,
        max_depth: input.depth,
        max_nodes: input.limit,
      }
    )

    if (graphError) {
      throw new Error(`Graph query failed: ${graphError.message}`)
    }

    const nodes: EntityConnectionNode[] = (graphData as any[]) || []

    // Transform into nodes + edges format for the frontend graph renderer
    const uniqueNodes = nodes.map((n) => ({
      id: n.entity_id,
      name: n.entity_name,
      type: n.entity_type,
      mention_count: n.mention_count,
      depth: n.depth,
    }))

    const edges = nodes
      .filter((n) => n.connected_from !== null)
      .map((n) => ({
        source: n.connected_from,
        target: n.entity_id,
        relationship_type: n.relationship_type,
        strength: n.relationship_strength,
      }))

    return success({ nodes: uniqueNodes, edges })
  } catch (err) {
    return handleApiError(err)
  }
}

// app/api/entity/[id]/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, notFound, error as apiError, handleApiError } from '@/lib/api/responses'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    if (!UUID_RE.test(id)) {
      return apiError('Invalid entity ID', 400)
    }
    const supabase = await createClient()

    // Fetch entity with basic data
    const { data: entity, error } = await supabase
      .from('entities')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !entity) {
      return notFound('Entity not found')
    }

    // Fetch mention stats per document
    const { data: mentionStats } = await supabase.rpc('get_entity_mention_stats', {
      target_entity_id: id,
    })

    // Fetch top related entities (via relationships)
    const { data: relationships } = await supabase
      .from('entity_relationships')
      .select(
        `
        id,
        relationship_type,
        description,
        strength,
        entity_a_id,
        entity_b_id
      `
      )
      .or(`entity_a_id.eq.${id},entity_b_id.eq.${id}`)
      .order('strength', { ascending: false })
      .limit(10)

    // For each relationship, fetch the related entity name
    const relatedEntityIds = (relationships || []).map((r: any) =>
      r.entity_a_id === id ? r.entity_b_id : r.entity_a_id
    )

    let relatedEntities: any[] = []
    if (relatedEntityIds.length > 0) {
      const { data: entities } = await supabase
        .from('entities')
        .select('id, name, entity_type, mention_count')
        .in('id', relatedEntityIds)

      relatedEntities = entities || []
    }

    // Combine relationship data with entity names
    const relatedWithNames = (relationships || []).map((r: any) => {
      const relatedId = r.entity_a_id === id ? r.entity_b_id : r.entity_a_id
      const related = relatedEntities.find((e: any) => e.id === relatedId)
      return {
        relationship_id: r.id,
        relationship_type: r.relationship_type,
        description: r.description,
        strength: r.strength,
        entity: related || null,
      }
    })

    return success({
      ...entity,
      mention_stats: mentionStats || [],
      related_entities: relatedWithNames,
    })
  } catch (err) {
    return handleApiError(err)
  }
}

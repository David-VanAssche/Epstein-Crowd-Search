// app/api/entity/[id]/dossier/route.ts
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

    // Fetch entity
    const { data: entity, error: entityError } = await supabase
      .from('entities')
      .select('*')
      .eq('id', id)
      .single()

    if (entityError || !entity) {
      return notFound('Entity not found')
    }

    // Fetch all document mentions grouped by document
    const { data: mentionStats } = await supabase.rpc('get_entity_mention_stats', {
      target_entity_id: id,
    })

    // Fetch all relationships
    const { data: relationships } = await supabase
      .from('entity_relationships')
      .select(
        `
        id,
        relationship_type,
        description,
        strength,
        is_verified,
        entity_a_id,
        entity_b_id
      `
      )
      .or(`entity_a_id.eq.${id},entity_b_id.eq.${id}`)
      .order('strength', { ascending: false })

    // Fetch related entity names
    const relatedIds = (relationships || []).map((r: any) =>
      r.entity_a_id === id ? r.entity_b_id : r.entity_a_id
    )

    let relatedEntities: any[] = []
    if (relatedIds.length > 0) {
      const { data } = await supabase
        .from('entities')
        .select('id, name, entity_type')
        .in('id', relatedIds)
      relatedEntities = data || []
    }

    // Fetch timeline events involving this entity
    const { data: timelineEvents } = await supabase
      .from('timeline_events')
      .select('*')
      .contains('entity_ids', [id])
      .order('event_date', { ascending: true })
      .limit(100)

    // Compile dossier sections
    const dossier = {
      entity: {
        name: entity.name,
        type: entity.entity_type,
        aliases: entity.aliases,
        description: entity.description,
        first_seen: entity.first_seen_date,
        last_seen: entity.last_seen_date,
        total_mentions: entity.mention_count,
        total_documents: entity.document_count,
      },
      involvement_summary: {
        document_appearances: mentionStats || [],
        total_documents: ((mentionStats as any[]) || []).length,
        total_mentions: entity.mention_count,
      },
      relationship_map: (relationships || []).map((r: any) => {
        const relatedId = r.entity_a_id === id ? r.entity_b_id : r.entity_a_id
        const related = relatedEntities.find((e: any) => e.id === relatedId)
        return {
          relationship_type: r.relationship_type,
          description: r.description,
          strength: r.strength,
          is_verified: r.is_verified,
          connected_entity: related
            ? { id: related.id, name: related.name, type: related.entity_type }
            : null,
        }
      }),
      timeline: (timelineEvents || []).map((e: any) => ({
        date: e.event_date,
        date_display: e.date_display,
        description: e.description,
        event_type: e.event_type,
        location: e.location,
        is_verified: e.is_verified,
      })),
      generated_at: new Date().toISOString(),
    }

    return success(dossier)
  } catch (err) {
    return handleApiError(err)
  }
}

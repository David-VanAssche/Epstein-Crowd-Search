// app/api/graph/path/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { pathFinderSchema, parseSearchParams } from '@/lib/api/schemas'
import { success, notFound, handleApiError } from '@/lib/api/responses'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const params = parseSearchParams(url)
    const input = pathFinderSchema.parse(params)

    const supabase = await createClient()

    // Resolve source entity (name or UUID)
    const sourceEntity = await resolveEntity(input.source, supabase)
    if (!sourceEntity) return notFound(`Source entity not found: ${input.source}`)

    const targetEntity = await resolveEntity(input.target, supabase)
    if (!targetEntity) return notFound(`Target entity not found: ${input.target}`)

    // Call shortest path function
    const { data: path, error } = await supabase.rpc('find_shortest_path', {
      source_entity_id: sourceEntity.id,
      target_entity_id: targetEntity.id,
      max_depth: input.max_depth,
    })

    if (error) throw new Error(`Path finder failed: ${error.message}`)

    const pathArray = path as any[] | null
    if (!pathArray || pathArray.length === 0) {
      return notFound('No connection path found between these entities')
    }

    // Enrich path steps with document info
    const enrichedPath = await enrichPathWithDocuments(pathArray, supabase)

    return success({
      source: { id: sourceEntity.id, name: sourceEntity.name, type: sourceEntity.entity_type },
      target: { id: targetEntity.id, name: targetEntity.name, type: targetEntity.entity_type },
      path: enrichedPath,
      degrees_of_separation: enrichedPath.length - 1,
    })
  } catch (err) {
    return handleApiError(err)
  }
}

async function resolveEntity(
  nameOrId: string,
  supabase: any
): Promise<{ id: string; name: string; entity_type: string } | null> {
  // Try UUID first
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (uuidRegex.test(nameOrId)) {
    const { data } = await supabase
      .from('entities')
      .select('id, name, entity_type')
      .eq('id', nameOrId)
      .single()
    return data
  }

  // Try exact name match
  const { data: exactMatch } = await supabase
    .from('entities')
    .select('id, name, entity_type')
    .ilike('name', nameOrId)
    .limit(1)
    .single()

  if (exactMatch) return exactMatch

  // Try fuzzy match
  const { data: fuzzyMatches } = await supabase
    .from('entities')
    .select('id, name, entity_type')
    .ilike('name', `%${nameOrId}%`)
    .order('mention_count', { ascending: false })
    .limit(1)
    .single()

  return fuzzyMatches
}

async function enrichPathWithDocuments(path: any[], supabase: any) {
  const enriched = []
  for (const step of path) {
    const docIds = (step.evidence_document_ids || []).slice(0, 5)
    let evidenceDocs: any[] = []

    if (docIds.length > 0) {
      const { data } = await supabase
        .from('documents')
        .select('id, filename')
        .in('id', docIds)

      evidenceDocs = (data || []).map((d: any) => ({
        id: d.id,
        filename: d.filename,
      }))
    }

    enriched.push({
      step_number: step.step_number,
      entity_id: step.entity_id,
      entity_name: step.entity_name,
      entity_type: step.entity_type,
      relationship_type: step.relationship_type,
      from_entity_id: step.from_entity_id,
      evidence_document_ids: step.evidence_document_ids || [],
      evidence_documents: evidenceDocs,
    })
  }
  return enriched
}

// app/api/stats/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, handleApiError } from '@/lib/api/responses'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Try the materialized view first
    const { data: stats, error } = await supabase
      .from('corpus_stats')
      .select('*')
      .limit(1)
      .single()

    // Fetch breakdowns that aren't in the mat view (always needed)
    const [entitiesByTypeResult, redactionsByStatusResult, flightCountResult, pageCountResult] = await Promise.all([
      supabase.from('entities').select('entity_type'),
      supabase.from('redactions').select('status'),
      supabase.from('flights').select('id', { count: 'exact', head: true }),
      supabase.from('datasets').select('page_count'),
    ])

    // Aggregate entities by type
    const entitiesByType: Record<string, number> = {}
    for (const row of entitiesByTypeResult.data ?? []) {
      const t = row.entity_type || 'unknown'
      entitiesByType[t] = (entitiesByType[t] || 0) + 1
    }

    // Aggregate redactions by status
    const redactionsByStatus: Record<string, number> = { solved: 0, proposed: 0, unsolved: 0 }
    for (const row of redactionsByStatusResult.data ?? []) {
      const s = row.status || 'unsolved'
      if (s === 'confirmed') redactionsByStatus.solved += 1
      else if (s === 'proposed') redactionsByStatus.proposed += 1
      else redactionsByStatus.unsolved += 1
    }

    const totalFlights = flightCountResult.count || 0

    // Sum total pages from datasets table
    const totalPages = (pageCountResult.data ?? []).reduce(
      (sum: number, row: { page_count: number }) => sum + (row.page_count || 0),
      0
    )

    if (error) {
      // Materialized view might not be refreshed yet.
      // Fall back to live counts (slower but always accurate).
      const [
        { count: docCount },
        { count: processedCount },
        { count: chunkCount },
        { count: imageCount },
        { count: videoCount },
        { count: entityCount },
        { count: relationshipCount },
        { count: redactionCount },
        { count: solvedCount },
      ] = await Promise.all([
        supabase.from('documents').select('id', { count: 'exact', head: true }),
        supabase.from('documents').select('id', { count: 'exact', head: true }).eq('processing_status', 'complete'),
        supabase.from('chunks').select('id', { count: 'exact', head: true }),
        supabase.from('images').select('id', { count: 'exact', head: true }),
        supabase.from('videos').select('id', { count: 'exact', head: true }),
        supabase.from('entities').select('id', { count: 'exact', head: true }),
        supabase.from('entity_relationships').select('id', { count: 'exact', head: true }),
        supabase.from('redactions').select('id', { count: 'exact', head: true }),
        supabase.from('redactions').select('id', { count: 'exact', head: true }).eq('status', 'confirmed'),
      ])

      return success({
        total_documents: docCount || 0,
        processed_documents: processedCount || 0,
        total_pages: totalPages,
        total_chunks: chunkCount || 0,
        total_images: imageCount || 0,
        total_videos: videoCount || 0,
        total_entities: entityCount || 0,
        total_relationships: relationshipCount || 0,
        total_redactions: redactionCount || 0,
        solved_redactions: solvedCount || 0,
        corroborated_redactions: 0,
        total_proposals: 0,
        total_contributors: 0,
        total_flights: totalFlights,
        entities_by_type: entitiesByType,
        redactions_by_status: redactionsByStatus,
      })
    }

    return success({
      ...stats,
      total_pages: stats.total_pages || totalPages,
      total_flights: totalFlights,
      entities_by_type: entitiesByType,
      redactions_by_status: redactionsByStatus,
    })
  } catch (err) {
    return handleApiError(err)
  }
}

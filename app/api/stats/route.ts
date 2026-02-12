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
        total_pages: null,
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
      })
    }

    return success(stats)
  } catch (err) {
    return handleApiError(err)
  }
}

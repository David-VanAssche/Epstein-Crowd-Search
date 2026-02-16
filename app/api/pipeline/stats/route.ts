// app/api/pipeline/stats/route.ts
// Returns per-stage document/image/video counts for the pipeline dashboard.
// Uses server-side RPC functions for efficient aggregation (no client-side sums).

import { createClient } from '@/lib/supabase/server'
import { success, handleApiError } from '@/lib/api/responses'
import { PROCESSING_STATUS } from '@/lib/pipeline/stages'

export const revalidate = 60 // cache for 60 seconds

/** Maps processing_status values to an ordered list of "completed through" stages */
const STATUS_STAGE_ORDER = [
  PROCESSING_STATUS.PENDING,
  PROCESSING_STATUS.OCR,
  PROCESSING_STATUS.CLASSIFYING,
  PROCESSING_STATUS.CHUNKING,
  PROCESSING_STATUS.EMBEDDING,
  PROCESSING_STATUS.ENTITY_EXTRACTION,
  PROCESSING_STATUS.RELATIONSHIP_MAPPING,
  PROCESSING_STATUS.REDACTION_DETECTION,
  PROCESSING_STATUS.SUMMARIZING,
  PROCESSING_STATUS.COMPLETE,
  PROCESSING_STATUS.FAILED,
] as const

export async function GET() {
  try {
    const supabase = await createClient()

    // Count documents by processing_status
    const statusCounts: Record<string, number> = {}
    const countPromises = STATUS_STAGE_ORDER.map(async (status) => {
      const { count } = await supabase
        .from('documents')
        .select('id', { count: 'exact', head: true })
        .eq('processing_status', status)
      statusCounts[status] = count ?? 0
    })

    // Use server-side RPC for corpus totals (replaces broken media_type queries)
    const totalsPromise = supabase.rpc('corpus_totals').single()

    // Use server-side RPC for per-stage completion counts
    const stageCountsPromise = supabase.rpc('pipeline_stage_counts')

    await Promise.all([...countPromises, totalsPromise, stageCountsPromise])

    const { data: rawTotals, error: totalsError } = await totalsPromise
    const { data: rawStageCounts, error: stageError } = await stageCountsPromise

    if (totalsError) {
      console.error('corpus_totals RPC failed:', totalsError)
    }
    if (stageError) {
      console.error('pipeline_stage_counts RPC failed:', stageError)
    }

    const totals = rawTotals as { total_documents: number; total_pages: number; total_images: number; total_videos: number; total_audio: number } | null
    const stageCounts = rawStageCounts as Array<{ stage: string; completed_count: number; total_count: number }> | null

    // Build per-stage map: { stage_name: { completed, total } }
    const byStage: Record<string, { completed: number; total: number }> = {}
    if (stageCounts) {
      for (const row of stageCounts) {
        byStage[row.stage] = {
          completed: Number(row.completed_count) || 0,
          total: Number(row.total_count) || 0,
        }
      }
    }

    return success({
      by_status: statusCounts,
      by_media_type: {
        pdf: Number(totals?.total_documents) || 0,
        image: Number(totals?.total_images) || 0,
        video: Number(totals?.total_videos) || 0,
        audio: Number(totals?.total_audio) || 0,
      },
      total_documents: Number(totals?.total_documents) || 0,
      total_pages: Number(totals?.total_pages) || 0,
      by_stage: byStage,
    })
  } catch (err) {
    return handleApiError(err)
  }
}

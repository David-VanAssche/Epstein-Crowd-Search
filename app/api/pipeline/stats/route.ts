// app/api/pipeline/stats/route.ts
// Returns pipeline flow stats for the waterfall dashboard.
// Single RPC call, cached for 60 seconds.

import { createClient } from '@/lib/supabase/server'
import { success, handleApiError } from '@/lib/api/responses'

export const revalidate = 60 // cache for 60 seconds

export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('pipeline_flow_stats').single()

    if (error) {
      console.error('pipeline_flow_stats RPC failed:', error)
      // Return empty defaults so UI doesn't break
      return success({
        total_documents: 0,
        ocr_completed: 0,
        classified: 0,
        stage_completed: {},
        classification_breakdown: {},
      })
    }

    return success(data)
  } catch (err) {
    return handleApiError(err)
  }
}

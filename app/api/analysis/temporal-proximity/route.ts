// app/api/analysis/temporal-proximity/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { temporalProximitySchema, parseSearchParams } from '@/lib/api/schemas'
import { success, handleApiError } from '@/lib/api/responses'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const params = parseSearchParams(url)
    const input = temporalProximitySchema.parse(params)

    const supabase = await createClient()

    const { data, error } = await supabase.rpc('find_temporal_clusters', {
      target_entity_id: input.entity_id,
      window_days: input.window_days,
      max_results: input.max_results,
    })

    if (error) throw new Error(`Temporal query failed: ${error.message}`)

    return success(data || [])
  } catch (err) {
    return handleApiError(err)
  }
}

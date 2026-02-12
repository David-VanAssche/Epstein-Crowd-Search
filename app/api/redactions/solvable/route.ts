// app/api/redactions/solvable/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { paginationSchema, parseSearchParams } from '@/lib/api/schemas'
import { paginated, handleApiError } from '@/lib/api/responses'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const queryParams = parseSearchParams(url)
    const input = paginationSchema.parse(queryParams)

    const typeFilter = url.searchParams.get('type') || null
    const datasetFilter = url.searchParams.get('dataset_id') || null

    const supabase = await createClient()

    const { data: solvable, error } = await supabase.rpc('get_solvable_redactions', {
      limit_count: input.per_page,
      offset_count: (input.page - 1) * input.per_page,
      status_filter: 'unsolved',
      type_filter: typeFilter,
      dataset_filter: datasetFilter,
    })

    if (error) {
      throw new Error(`Solvable redactions query failed: ${error.message}`)
    }

    // Get total count for pagination
    const { count } = await supabase
      .from('redactions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'unsolved')

    return paginated((solvable as any[]) || [], input.page, input.per_page, count || 0)
  } catch (err) {
    return handleApiError(err)
  }
}

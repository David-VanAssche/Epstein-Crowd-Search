// app/api/audio/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { paginationSchema, parseSearchParams } from '@/lib/api/schemas'
import { paginated, handleApiError } from '@/lib/api/responses'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const queryParams = parseSearchParams(url)
    const pagination = paginationSchema.parse(queryParams)
    const datasetId = url.searchParams.get('dataset_id')

    const supabase = await createClient()
    const offset = (pagination.page - 1) * pagination.per_page

    let query = supabase
      .from('audio_files')
      .select(
        `
        id,
        document_id,
        filename,
        storage_path,
        duration_seconds,
        transcript,
        file_type,
        processing_status,
        created_at,
        datasets ( name )
      `,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + pagination.per_page - 1)

    if (datasetId) {
      query = query.eq('dataset_id', datasetId)
    }

    const { data: audioFiles, count, error } = await query

    if (error) {
      throw new Error(`Audio query failed: ${error.message}`)
    }

    return paginated(audioFiles || [], pagination.page, pagination.per_page, count || 0)
  } catch (err) {
    return handleApiError(err)
  }
}

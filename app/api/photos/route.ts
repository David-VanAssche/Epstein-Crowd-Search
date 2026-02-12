// app/api/photos/route.ts
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
    const hasRedaction = url.searchParams.get('has_redaction')

    const supabase = await createClient()
    const offset = (pagination.page - 1) * pagination.per_page

    let query = supabase
      .from('images')
      .select(
        `
        id,
        document_id,
        filename,
        storage_path,
        description,
        width,
        height,
        is_redacted,
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
    if (hasRedaction === 'true') {
      query = query.eq('is_redacted', true)
    }

    const { data: images, count, error } = await query

    if (error) {
      throw new Error(`Photos query failed: ${error.message}`)
    }

    return paginated(images || [], pagination.page, pagination.per_page, count || 0)
  } catch (err) {
    return handleApiError(err)
  }
}

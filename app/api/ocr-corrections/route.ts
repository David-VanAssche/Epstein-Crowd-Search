// app/api/ocr-corrections/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ocrCorrectionSchema, paginationSchema, parseSearchParams } from '@/lib/api/schemas'
import { success, paginated, handleApiError } from '@/lib/api/responses'
import { requireAuth } from '@/lib/auth/middleware'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const documentId = url.searchParams.get('document_id')
    const queryParams = parseSearchParams(url)
    const pagination = paginationSchema.parse(queryParams)

    const supabase = await createClient()
    const offset = (pagination.page - 1) * pagination.per_page

    let query = supabase
      .from('ocr_corrections')
      .select(
        `
        *,
        user_profiles ( display_name, avatar_url )
      `,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + pagination.per_page - 1)

    if (documentId) {
      query = query.eq('document_id', documentId)
    }

    const { data: corrections, count, error } = await query

    if (error) {
      throw new Error(`OCR corrections query failed: ${error.message}`)
    }

    return paginated(corrections || [], pagination.page, pagination.per_page, count || 0)
  } catch (err) {
    return handleApiError(err)
  }
}

export async function POST(request: NextRequest) {
  try {
    const userOrResponse = await requireAuth()
    if (userOrResponse instanceof Response) return userOrResponse
    const user = userOrResponse

    const body = await request.json()
    const input = ocrCorrectionSchema.parse(body)

    const supabase = await createClient()

    const { data: correction, error } = await supabase
      .from('ocr_corrections')
      .insert({
        user_id: user.id,
        document_id: input.document_id,
        chunk_id: input.chunk_id || null,
        page_number: input.page_number || null,
        original_text: input.original_text,
        corrected_text: input.corrected_text,
        status: 'pending',
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to submit OCR correction: ${error.message}`)
    }

    return success(correction)
  } catch (err) {
    return handleApiError(err)
  }
}

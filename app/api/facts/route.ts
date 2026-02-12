// app/api/facts/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { factCreateSchema, paginationSchema, parseSearchParams } from '@/lib/api/schemas'
import { success, paginated, handleApiError } from '@/lib/api/responses'
import { requireAuth } from '@/lib/auth/middleware'

/** Sanitize input for PostgREST filter strings. */
function sanitizeFilterValue(value: string): string {
  return value.replace(/[\\%_*(),."]/g, '\\$&')
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const queryParams = parseSearchParams(url)
    const pagination = paginationSchema.parse(queryParams)
    const searchQuery = url.searchParams.get('q')
    const status = url.searchParams.get('status') || 'verified'

    const supabase = await createClient()
    const offset = (pagination.page - 1) * pagination.per_page

    let query = supabase
      .from('fact_registry')
      .select('*', { count: 'exact' })
      .eq('status', status)
      .order('verification_count', { ascending: false })
      .range(offset, offset + pagination.per_page - 1)

    if (searchQuery) {
      query = query.ilike('fact_text', `%${sanitizeFilterValue(searchQuery)}%`)
    }

    const { data: facts, count, error } = await query

    if (error) {
      throw new Error(`Facts query failed: ${error.message}`)
    }

    return paginated(facts || [], pagination.page, pagination.per_page, count || 0)
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
    const input = factCreateSchema.parse(body)

    const supabase = await createClient()

    const { data: fact, error } = await supabase
      .from('fact_registry')
      .insert({
        fact_text: input.fact_text,
        entity_ids: input.entity_ids,
        supporting_chunk_ids: input.supporting_chunk_ids,
        supporting_document_ids: input.supporting_document_ids,
        created_by: user.id,
        status: 'proposed',
        confidence: 0,
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to propose fact: ${error.message}`)
    }

    return success(fact)
  } catch (err) {
    return handleApiError(err)
  }
}

// app/api/search/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { searchRequestSchema, parseSearchParams } from '@/lib/api/schemas'
import { success, paginated, handleApiError } from '@/lib/api/responses'
import { checkRateLimit, getClientIP, RATE_LIMITS } from '@/lib/auth/rate-limit'
import { getUser } from '@/lib/auth/middleware'
import type { SearchResult } from '@/types/search'

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const user = await getUser()
    const identifier = user?.id || getClientIP(request)
    const rateLimitResponse = checkRateLimit(identifier, RATE_LIMITS.search)
    if (rateLimitResponse) return rateLimitResponse

    // Parse and validate request body
    const body = await request.json()
    const input = searchRequestSchema.parse(body)

    const supabase = await createClient()

    // All embeddings use Amazon Nova Multimodal Embeddings v1 (1024d).
    // When AWS Bedrock API keys are available, generate query embedding with Nova
    // and call hybrid_search_chunks_rrf with the 1024d query vector.
    // For now, fall back to keyword-only search.

    const offset = (input.page - 1) * input.per_page

    // Build the query
    let query = supabase
      .from('chunks')
      .select(
        `
        id,
        document_id,
        content,
        contextual_header,
        page_number,
        section_title,
        documents!inner (
          filename,
          classification,
          dataset_id,
          date_extracted,
          datasets ( name )
        )
      `,
        { count: 'exact' }
      )
      .textSearch('content_tsv', input.query, { type: 'websearch' })
      .range(offset, offset + input.per_page - 1)

    // Apply filters
    if (input.filters?.dataset_id) {
      query = query.eq('documents.dataset_id', input.filters.dataset_id)
    }
    if (input.filters?.doc_type) {
      query = query.eq('documents.classification', input.filters.doc_type)
    }
    if (input.filters?.date_from) {
      query = query.gte('documents.date_extracted', input.filters.date_from)
    }
    if (input.filters?.date_to) {
      query = query.lte('documents.date_extracted', input.filters.date_to)
    }

    const { data: chunks, count, error } = await query

    if (error) {
      console.error('[Search API] Query error:', error.message)
      throw new Error(`Search failed: ${error.message}`)
    }

    // Transform to SearchResult shape
    const results: SearchResult[] = (chunks || []).map((chunk: any) => ({
      chunk_id: chunk.id,
      document_id: chunk.document_id,
      content: chunk.content,
      contextual_header: chunk.contextual_header,
      page_number: chunk.page_number,
      section_title: chunk.section_title,
      document_filename: chunk.documents?.filename || '',
      document_classification: chunk.documents?.classification || null,
      dataset_name: chunk.documents?.datasets?.name || null,
      rrf_score: 0, // No RRF without embeddings yet
      semantic_rank: null,
      keyword_rank: null,
    }))

    return paginated(results, input.page, input.per_page, count || 0)
  } catch (err) {
    return handleApiError(err)
  }
}

// GET endpoint for URL-param-based search (for shareable links)
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const q = url.searchParams.get('q')

    if (!q) {
      return success([])
    }

    // Rate limiting
    const user = await getUser()
    const identifier = user?.id || getClientIP(request)
    const rateLimitResponse = checkRateLimit(identifier, RATE_LIMITS.search)
    if (rateLimitResponse) return rateLimitResponse

    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10))
    const per_page = Math.min(100, Math.max(1, parseInt(url.searchParams.get('per_page') || '20', 10)))

    const supabase = await createClient()
    const offset = (page - 1) * per_page

    const { data: chunks, count, error } = await supabase
      .from('chunks')
      .select(
        `
        id,
        document_id,
        content,
        contextual_header,
        page_number,
        section_title,
        documents!inner (
          filename,
          classification,
          datasets ( name )
        )
      `,
        { count: 'exact' }
      )
      .textSearch('content_tsv', q, { type: 'websearch' })
      .range(offset, offset + per_page - 1)

    if (error) {
      throw new Error(`Search failed: ${error.message}`)
    }

    const results: SearchResult[] = (chunks || []).map((chunk: any) => ({
      chunk_id: chunk.id,
      document_id: chunk.document_id,
      content: chunk.content,
      contextual_header: chunk.contextual_header,
      page_number: chunk.page_number,
      section_title: chunk.section_title,
      document_filename: chunk.documents?.filename || '',
      document_classification: chunk.documents?.classification || null,
      dataset_name: chunk.documents?.datasets?.name || null,
      rrf_score: 0,
      semantic_rank: null,
      keyword_rank: null,
    }))

    return paginated(results, page, per_page, count || 0)
  } catch (err) {
    return handleApiError(err)
  }
}

// app/api/search/multimodal/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { multimodalSearchRequestSchema } from '@/lib/api/schemas'
import { paginated, handleApiError } from '@/lib/api/responses'
import { checkRateLimit, getClientIP, RATE_LIMITS } from '@/lib/auth/rate-limit'
import { getUser } from '@/lib/auth/middleware'
import type { MultimodalResult } from '@/types/search'

/** Sanitize input for PostgREST filter strings — escape chars that alter filter logic. */
function sanitizeFilterValue(value: string): string {
  return value.replace(/[\\%_*(),."]/g, '\\$&')
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const user = await getUser()
    const identifier = user?.id || getClientIP(request)
    const rateLimitResponse = checkRateLimit(identifier, RATE_LIMITS.search)
    if (rateLimitResponse) return rateLimitResponse

    const body = await request.json()
    const input = multimodalSearchRequestSchema.parse(body)

    const supabase = await createClient()

    // Multimodal search requires Nova 1024d embeddings (Phase 6).
    // With unified embeddings, one query vector searches all modalities natively.
    // For now, do text-only keyword search across chunks, images, and video_chunks.
    const results: MultimodalResult[] = []

    // Document search (keyword fallback)
    if (input.modalities.documents) {
      const { data: docResults } = await supabase
        .from('chunks')
        .select(
          `
          id,
          document_id,
          content,
          page_number,
          documents!inner (
            filename,
            datasets ( name )
          )
        `
        )
        .textSearch('content_tsv', input.query, { type: 'websearch' })
        .limit(input.per_page)

      if (docResults) {
        results.push(
          ...docResults.map((c: any) => ({
            result_id: c.id,
            source_type: 'document' as const,
            content: c.content,
            document_id: c.document_id,
            page_number: c.page_number,
            storage_path: null,
            filename: c.documents?.filename || null,
            dataset_name: c.documents?.datasets?.name || null,
            rrf_score: 0,
          }))
        )
      }
    }

    // Image search (description text match)
    if (input.modalities.images) {
      const { data: imgResults } = await supabase
        .from('images')
        .select(
          `
          id,
          document_id,
          description,
          ocr_text,
          page_number,
          storage_path,
          filename,
          datasets ( name )
        `
        )
        .or(`description.ilike.%${sanitizeFilterValue(input.query)}%,ocr_text.ilike.%${sanitizeFilterValue(input.query)}%`)
        .limit(input.per_page)

      if (imgResults) {
        results.push(
          ...imgResults.map((img: any) => ({
            result_id: img.id,
            source_type: 'image' as const,
            content: img.description || img.ocr_text || 'Image',
            document_id: img.document_id,
            page_number: img.page_number,
            storage_path: img.storage_path,
            filename: img.filename,
            dataset_name: img.datasets?.name || null,
            rrf_score: 0,
          }))
        )
      }
    }

    // Video search (transcript text search)
    if (input.modalities.videos) {
      const { data: vidResults } = await supabase
        .from('video_chunks')
        .select(
          `
          id,
          content,
          videos!inner (
            id,
            document_id,
            storage_path,
            filename,
            datasets ( name )
          )
        `
        )
        .textSearch('content_tsv', input.query, { type: 'websearch' })
        .limit(input.per_page)

      if (vidResults) {
        results.push(
          ...vidResults.map((vc: any) => ({
            result_id: vc.id,
            source_type: 'video' as const,
            content: vc.content,
            document_id: vc.videos?.document_id || null,
            page_number: null,
            storage_path: vc.videos?.storage_path || null,
            filename: vc.videos?.filename || null,
            dataset_name: vc.videos?.datasets?.name || null,
            rrf_score: 0,
          }))
        )
      }
    }

    // Sort by rrf_score (placeholder --- real scoring comes with embeddings)
    results.sort((a, b) => b.rrf_score - a.rrf_score)
    const paginatedResults = results.slice(0, input.per_page)

    return paginated(paginatedResults, input.page, input.per_page, results.length)
  } catch (err) {
    return handleApiError(err)
  }
}

// app/api/document/[id]/similar/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, handleApiError } from '@/lib/api/responses'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') || '10', 10)

    const supabase = await createClient()

    // Get the first chunk embedding for this document to use as query vector
    const { data: sourceChunk, error: chunkError } = await supabase
      .from('chunks')
      .select('content_embedding')
      .eq('document_id', id)
      .not('content_embedding', 'is', null)
      .order('chunk_index', { ascending: true })
      .limit(1)
      .single()

    if (chunkError || !sourceChunk?.content_embedding) {
      // No embeddings available --- return empty array.
      // This is expected before Phase 5 generates embeddings.
      return success([])
    }

    // Use the embedding to find similar chunks from OTHER documents
    const { data: similarChunks, error: searchError } = await supabase.rpc(
      'hybrid_search_chunks_rrf',
      {
        query_text: '',
        query_embedding: sourceChunk.content_embedding,
        match_count: limit * 3,
      }
    )

    if (searchError) {
      throw new Error(`Similar search failed: ${searchError.message}`)
    }

    // Deduplicate by document_id, exclude the source document
    const seenDocIds = new Set<string>([id])
    const uniqueResults: any[] = []

    for (const chunk of (similarChunks as any[]) || []) {
      if (seenDocIds.has(chunk.document_id)) continue
      seenDocIds.add(chunk.document_id)
      uniqueResults.push({
        document_id: chunk.document_id,
        document_filename: chunk.document_filename,
        document_classification: chunk.document_classification,
        dataset_name: chunk.dataset_name,
        preview_content: chunk.content.slice(0, 300),
        similarity_score: chunk.rrf_score,
      })
      if (uniqueResults.length >= limit) break
    }

    return success(uniqueResults)
  } catch (err) {
    return handleApiError(err)
  }
}

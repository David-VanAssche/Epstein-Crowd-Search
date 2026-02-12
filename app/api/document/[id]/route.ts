// app/api/document/[id]/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, notFound, handleApiError } from '@/lib/api/responses'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const url = new URL(request.url)
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10))
    const per_page = Math.min(100, Math.max(1, parseInt(url.searchParams.get('per_page') || '50', 10)))

    const supabase = await createClient()

    // Fetch document metadata
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select(
        `
        *,
        datasets ( id, name, dataset_number )
      `
      )
      .eq('id', id)
      .single()

    if (docError || !document) {
      return notFound('Document not found')
    }

    // Fetch paginated chunks
    const offset = (page - 1) * per_page
    const { data: chunks, count: chunkCount } = await supabase
      .from('chunks')
      .select('id, chunk_index, content, contextual_header, page_number, section_title', {
        count: 'exact',
      })
      .eq('document_id', id)
      .order('chunk_index', { ascending: true })
      .range(offset, offset + per_page - 1)

    // Fetch redactions for this document
    const { data: redactions } = await supabase
      .from('redactions')
      .select(
        `
        id,
        page_number,
        redaction_type,
        char_length_estimate,
        surrounding_text,
        sentence_template,
        status,
        resolved_text,
        confidence,
        potential_cascade_count
      `
      )
      .eq('document_id', id)
      .order('page_number', { ascending: true })

    // Fetch entity mentions for this document
    const { data: mentions } = await supabase
      .from('entity_mentions')
      .select(
        `
        id,
        entity_id,
        mention_text,
        context_snippet,
        mention_type,
        page_number,
        entities ( id, name, entity_type )
      `
      )
      .eq('document_id', id)
      .limit(200)

    return success({
      document,
      chunks: chunks || [],
      chunk_pagination: {
        page,
        per_page,
        total: chunkCount || 0,
        has_more: page * per_page < (chunkCount || 0),
      },
      redactions: redactions || [],
      mentions: mentions || [],
    })
  } catch (err) {
    return handleApiError(err)
  }
}

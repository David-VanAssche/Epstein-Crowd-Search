// lib/chat/tools/search-documents.ts
import { SupabaseClient } from '@supabase/supabase-js'
import type { ChatTool } from '../chat-orchestrator'
import { embedTexts } from '@/lib/pipeline/services/embedding-service'

export const searchDocumentsTool: ChatTool = {
  name: 'search_documents',
  description:
    'Search the Epstein Files corpus using semantic and keyword search. Returns relevant document chunks with citations.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
      limit: { type: 'number', description: 'Max results (default 10)' },
      documentType: { type: 'string', description: 'Filter by document type' },
    },
    required: ['query'],
  },
  execute: async (params, supabase) => {
    const query = String(params.query)
    const limit = Number(params.limit) || 10

    // Generate Nova 1024d embedding for semantic search
    if (!process.env.AWS_ACCESS_KEY_ID) return 'Search unavailable: AWS credentials not configured'

    let queryEmbedding: number[]
    try {
      const [embedding] = await embedTexts([query])
      queryEmbedding = embedding
    } catch {
      return 'Search failed: embedding generation error'
    }

    // Call hybrid search RPC
    const { data: results, error } = await supabase.rpc('hybrid_search_chunks_rrf', {
      query_text: query,
      query_embedding: queryEmbedding,
      match_count: limit,
    })

    if (error || !results) return `Search error: ${error?.message || 'no results'}`

    // Format results as text for the LLM
    return results
      .map(
        (r: any, i: number) =>
          `[${i + 1}] Document: ${r.document_filename} (${r.document_classification || 'unclassified'})
Page: ${r.page_number || 'N/A'} | Dataset: ${r.dataset_name || 'N/A'}
---
${r.content.slice(0, 500)}
---
(doc_id: ${r.document_id}, chunk_id: ${r.chunk_id})`
      )
      .join('\n\n')
  },
}

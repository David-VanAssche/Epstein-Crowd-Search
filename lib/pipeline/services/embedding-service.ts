// lib/pipeline/services/embedding-service.ts
// Stage 5: Embedding — Generate 1024d Nova embeddings for all chunks.
// Uses Amazon Nova Multimodal Embeddings v1 via AWS Bedrock.
// Same model handles text, images, video, and audio in a unified 1024d space.

import { SupabaseClient } from '@supabase/supabase-js'
import { EmbeddingCache } from './embedding-cache'

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const region = process.env.AWS_REGION || 'us-east-1'
  const modelId = process.env.EMBEDDING_MODEL || 'amazon.nova-multimodal-embeddings-v1:0'

  // Nova text embedding via Bedrock InvokeModel
  const results: number[][] = []
  for (const text of texts) {
    const body = JSON.stringify({
      inputText: text,
      embeddingConfig: { outputEmbeddingLength: 1024 },
    })

    const response = await fetch(
      `https://bedrock-runtime.${region}.amazonaws.com/model/${modelId}/invoke`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body,
      }
    )

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Nova embedding failed (${response.status}): ${errText}`)
    }

    const data = await response.json()
    results.push(data.embedding)
  }
  return results
}

// For images: embed the raw image bytes directly (Nova supports image input natively)
export async function embedImage(imageBase64: string, _mimeType: string): Promise<number[]> {
  const region = process.env.AWS_REGION || 'us-east-1'
  const modelId = process.env.EMBEDDING_MODEL || 'amazon.nova-multimodal-embeddings-v1:0'

  const body = JSON.stringify({
    inputImage: imageBase64,
    embeddingConfig: { outputEmbeddingLength: 1024 },
  })

  const response = await fetch(
    `https://bedrock-runtime.${region}.amazonaws.com/model/${modelId}/invoke`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    }
  )

  if (!response.ok) throw new Error(`Nova image embedding failed: ${response.status}`)
  const data = await response.json()
  return data.embedding
}

function buildEmbeddingInput(content: string, contextualHeader: string | null): string {
  if (contextualHeader) {
    return `${contextualHeader}\n\n${content}`
  }
  return content
}

// Singleton cache instance
const embeddingCache = new EmbeddingCache({ maxMemoryEntries: 10_000 })

// --- Stage handler ---

export async function handleEmbed(
  documentId: string,
  supabase: SupabaseClient
): Promise<void> {
  console.log(`[Embed] Processing document ${documentId}`)

  if (!process.env.AWS_ACCESS_KEY_ID) throw new Error('AWS_ACCESS_KEY_ID not set')

  const { data: chunks, error } = await supabase
    .from('chunks')
    .select('id, content, contextual_header, content_embedding, embedding_model')
    .eq('document_id', documentId)
    .order('chunk_index', { ascending: true })

  if (error || !chunks) throw new Error(`Failed to fetch chunks: ${error?.message}`)

  const TARGET_MODEL = process.env.EMBEDDING_MODEL || 'amazon.nova-multimodal-embeddings-v1:0'
  // Embed chunks that either have no embedding or use a different model (enables upgrades)
  const needsEmbedding = chunks.filter(
    (c: any) => !c.content_embedding || c.embedding_model !== TARGET_MODEL
  )
  if (needsEmbedding.length === 0) {
    console.log(`[Embed] Document ${documentId}: all chunks already embedded`)
    return
  }

  const inputs = needsEmbedding.map((c: any) =>
    buildEmbeddingInput(c.content, c.contextual_header)
  )

  const BATCH_SIZE = parseInt(process.env.EMBEDDING_BATCH_SIZE || '100', 10)
  let embeddedCount = 0

  for (let i = 0; i < needsEmbedding.length; i += BATCH_SIZE) {
    const batchChunks = needsEmbedding.slice(i, i + BATCH_SIZE)
    const batchInputs = inputs.slice(i, i + BATCH_SIZE)

    const embeddings = await embeddingCache.batchGetOrCompute(batchInputs, (texts) =>
      embedTexts(texts)
    )

    for (let j = 0; j < batchChunks.length; j++) {
      const { error: updateError } = await supabase
        .from('chunks')
        .update({
          content_embedding: JSON.stringify(embeddings[j]),
          embedding_model: TARGET_MODEL,
        })
        .eq('id', (batchChunks[j] as any).id)

      if (!updateError) embeddedCount++
    }

    if (i + BATCH_SIZE < needsEmbedding.length) {
      await new Promise((r) => setTimeout(r, 200))
    }
  }

  console.log(
    `[Embed] Document ${documentId}: embedded ${embeddedCount}/${needsEmbedding.length} chunks`
  )
}

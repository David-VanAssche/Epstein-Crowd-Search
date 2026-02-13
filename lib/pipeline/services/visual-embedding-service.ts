// lib/pipeline/services/visual-embedding-service.ts
// Generates visual embeddings for images using Amazon Nova Multimodal Embeddings.
// Nova embeds the raw image pixels directly into the same 1024d space as text —
// no intermediate description step needed for search.

import { SupabaseClient } from '@supabase/supabase-js'
import { embedImage } from './embedding-service'

async function generateImageDescription(
  imageBuffer: Buffer,
  mimeType: string,
  apiKey: string
): Promise<string> {
  const base64 = imageBuffer.toString('base64')

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inlineData: { mimeType, data: base64 } },
              {
                text: `Describe this image in detail for a research database. Include:
- Who/what is visible (people, objects, locations)
- Any visible text, labels, or captions
- Setting and context
- Any notable details relevant to a legal investigation

Be thorough but factual. 2-4 sentences.`,
              },
            ],
          },
        ],
        generationConfig: { temperature: 0.2, maxOutputTokens: 300 },
      }),
    }
  )

  if (!response.ok) {
    throw new Error(`Image description API failed: ${response.status}`)
  }

  const data = await response.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No description generated'
}

// --- Stage handler ---

export async function handleVisualEmbed(
  documentId: string,
  supabase: SupabaseClient
): Promise<void> {
  console.log(`[VisualEmbed] Processing images for document ${documentId}`)

  if (!process.env.AWS_ACCESS_KEY_ID) throw new Error('AWS_ACCESS_KEY_ID not set')
  const geminiKey = process.env.GOOGLE_AI_API_KEY // Optional: for descriptions

  const { data: images, error } = await supabase
    .from('images')
    .select('id, storage_path, file_type, description, visual_embedding')
    .eq('document_id', documentId)

  if (error) throw new Error(`Failed to fetch images: ${error.message}`)
  if (!images || images.length === 0) {
    console.log(`[VisualEmbed] Document ${documentId}: no images found, skipping`)
    return
  }

  let processedCount = 0
  for (const image of images) {
    if ((image as any).visual_embedding) {
      processedCount++
      continue
    }

    try {
      const { data: fileData, error: dlError } = await supabase.storage
        .from('images')
        .download((image as any).storage_path)

      if (dlError || !fileData) {
        console.warn(`[VisualEmbed] Failed to download image ${(image as any).id}`)
        continue
      }

      const imageBuffer = Buffer.from(await fileData.arrayBuffer())
      const mimeType = (image as any).file_type || 'image/jpeg'
      const base64 = imageBuffer.toString('base64')

      // Embed image pixels directly with Nova (same 1024d space as text)
      const visualEmbedding = await embedImage(base64, mimeType)

      // Generate text description for display (optional, uses Gemini)
      let description = (image as any).description
      if (!description && geminiKey) {
        description = await generateImageDescription(imageBuffer, mimeType, geminiKey)
      }

      const { error: updateError } = await supabase
        .from('images')
        .update({
          ...(description && { description }),
          visual_embedding: JSON.stringify(visualEmbedding),
        })
        .eq('id', (image as any).id)

      if (!updateError) processedCount++

      await new Promise((r) => setTimeout(r, 500))
    } catch (err) {
      console.warn(`[VisualEmbed] Error processing image ${(image as any).id}:`, err)
    }
  }

  console.log(
    `[VisualEmbed] Document ${documentId}: processed ${processedCount}/${images.length} images`
  )
}

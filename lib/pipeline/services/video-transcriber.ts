// lib/pipeline/services/video-transcriber.ts
// Transcribe video files and create video_chunks records.
// Uses Whisper via OpenAI API for transcription.

import { SupabaseClient } from '@supabase/supabase-js'

export async function handleVideoTranscribe(
  videoId: string,
  supabase: SupabaseClient
): Promise<void> {
  console.log(`[Video] Processing video ${videoId}`)

  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) throw new Error('OPENAI_API_KEY not set')

  // Fetch video record
  const { data: video, error } = await supabase
    .from('videos')
    .select('id, filename, storage_path')
    .eq('id', videoId)
    .single()

  if (error || !video) throw new Error(`Video not found: ${videoId}`)

  // Download video
  const { data: fileData, error: dlError } = await supabase.storage
    .from('videos')
    .download((video as any).storage_path)

  if (dlError || !fileData) throw new Error(`Failed to download: ${dlError?.message}`)

  const videoBuffer = Buffer.from(await fileData.arrayBuffer())

  // Transcribe using Whisper
  const formData = new FormData()
  const blob = new Blob([new Uint8Array(videoBuffer)])
  formData.append('file', blob, (video as any).filename)
  formData.append('model', 'whisper-1')
  formData.append('response_format', 'verbose_json')
  formData.append('timestamp_granularities[]', 'segment')

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${openaiKey}` },
    body: formData,
  })

  if (!response.ok) throw new Error(`Whisper API failed: ${response.status}`)

  const data = await response.json()
  const segments = data.segments || []

  // Update video record
  await supabase
    .from('videos')
    .update({
      transcript: data.text,
      processing_status: 'complete',
      duration_seconds: segments.length > 0 ? Math.ceil(segments[segments.length - 1].end) : 0,
    })
    .eq('id', videoId)

  // Create video_chunks from segments (group into ~1000 char chunks)
  await supabase.from('video_chunks').delete().eq('video_id', videoId)

  let chunkIndex = 0
  let currentChunk = ''
  let chunkStart = 0

  for (const segment of segments) {
    if (currentChunk.length + segment.text.length > 1000 && currentChunk.length > 0) {
      await supabase.from('video_chunks').insert({
        video_id: videoId,
        chunk_index: chunkIndex++,
        content: currentChunk.trim(),
        timestamp_start: chunkStart,
        timestamp_end: segment.start,
      })
      currentChunk = ''
      chunkStart = segment.start
    }
    currentChunk += ' ' + segment.text
  }

  // Final chunk
  if (currentChunk.trim().length > 0) {
    await supabase.from('video_chunks').insert({
      video_id: videoId,
      chunk_index: chunkIndex,
      content: currentChunk.trim(),
      timestamp_start: chunkStart,
      timestamp_end: segments.length > 0 ? segments[segments.length - 1].end : 0,
    })
  }

  console.log(`[Video] Video ${videoId}: transcribed, created ${chunkIndex + 1} chunks`)
}

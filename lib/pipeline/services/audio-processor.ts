// lib/pipeline/services/audio-processor.ts
// Process audio files: transcribe, chunk, embed, extract entities.
// Uses Whisper (via OpenAI API) for transcription.

import { SupabaseClient } from '@supabase/supabase-js'

interface TranscriptSegment {
  start: number
  end: number
  text: string
  speaker?: string
}

async function transcribeAudio(
  audioBuffer: Buffer,
  filename: string,
  apiKey: string
): Promise<{ transcript: string; segments: TranscriptSegment[] }> {
  // Use OpenAI Whisper API
  const formData = new FormData()
  const blob = new Blob([new Uint8Array(audioBuffer)])
  formData.append('file', blob, filename)
  formData.append('model', 'whisper-1')
  formData.append('response_format', 'verbose_json')
  formData.append('timestamp_granularities[]', 'segment')

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  })

  if (!response.ok) {
    throw new Error(`Whisper API failed: ${response.status}`)
  }

  const data = await response.json()
  const segments: TranscriptSegment[] = (data.segments || []).map((s: any) => ({
    start: s.start,
    end: s.end,
    text: s.text,
  }))

  return { transcript: data.text, segments }
}

// --- Handler ---

export async function handleAudioProcess(
  audioFileId: string,
  supabase: SupabaseClient
): Promise<void> {
  console.log(`[Audio] Processing audio file ${audioFileId}`)

  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) throw new Error('OPENAI_API_KEY not set for audio transcription')

  // Fetch audio file record (assumes using documents table)
  const { data: audioFile, error } = await supabase
    .from('documents')
    .select('id, filename, storage_path, mime_type')
    .eq('id', audioFileId)
    .single()

  if (error || !audioFile) throw new Error(`Audio file not found: ${audioFileId}`)

  // Download audio
  const { data: fileData, error: dlError } = await supabase.storage
    .from('documents')
    .download((audioFile as any).storage_path)

  if (dlError || !fileData) throw new Error(`Failed to download: ${dlError?.message}`)

  const audioBuffer = Buffer.from(await fileData.arrayBuffer())

  // Transcribe
  const { transcript, segments } = await transcribeAudio(
    audioBuffer,
    (audioFile as any).filename,
    openaiKey
  )

  // Update document with transcript
  await supabase
    .from('documents')
    .update({
      ocr_text: transcript,
      metadata: {
        audio_segments: segments.length,
        audio_duration: segments.length > 0 ? segments[segments.length - 1].end : 0,
        transcription_timestamp: new Date().toISOString(),
      },
    })
    .eq('id', audioFileId)

  console.log(
    `[Audio] File ${audioFileId}: transcribed ${transcript.length} chars, ${segments.length} segments`
  )
}

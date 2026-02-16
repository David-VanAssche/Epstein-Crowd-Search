// lib/pipeline/services/audio-processor.ts
// Process audio files: transcribe, chunk, embed, extract entities.
// Uses Whisper (via OpenAI API) for transcription.
// Includes ffprobe-based prescreening (inspired by rhowardstone/prescreen_media.py).

import { SupabaseClient } from '@supabase/supabase-js'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { writeFile, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

const execFileAsync = promisify(execFile)

interface TranscriptSegment {
  start: number
  end: number
  text: string
  speaker?: string
}

// --- Media prescreening (inspired by rhowardstone/prescreen_media.py) ---

export interface MediaScreenResult {
  category: 'SPEECH_LIKELY' | 'SURVEILLANCE' | 'NO_AUDIO' | 'SPEECH_POSSIBLE' | 'SKIP'
  duration: number
  hasAudio: boolean
  resolution?: { width: number; height: number }
  reason: string
}

/**
 * Pre-screen media files using ffprobe to skip transcription for
 * silent files and long surveillance footage.
 */
export async function prescreenMedia(filePath: string): Promise<MediaScreenResult> {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_streams',
      '-show_format',
      filePath,
    ])

    const probe = JSON.parse(stdout)
    const streams = probe.streams || []
    const format = probe.format || {}

    const audioStreams = streams.filter((s: any) => s.codec_type === 'audio')
    const videoStreams = streams.filter((s: any) => s.codec_type === 'video')
    const duration = parseFloat(format.duration || '0')

    const hasAudio = audioStreams.length > 0
    const resolution = videoStreams.length > 0
      ? { width: parseInt(videoStreams[0].width || '0'), height: parseInt(videoStreams[0].height || '0') }
      : undefined

    if (!hasAudio) {
      return {
        category: 'NO_AUDIO',
        duration,
        hasAudio: false,
        resolution,
        reason: 'No audio stream detected',
      }
    }

    // Surveillance detection: low resolution + long duration
    if (
      resolution &&
      ((resolution.width <= 320 && resolution.height <= 240) ||
        (resolution.width <= 640 && resolution.height <= 480)) &&
      duration > 3000
    ) {
      return {
        category: 'SURVEILLANCE',
        duration,
        hasAudio: true,
        resolution,
        reason: `Low resolution ${resolution.width}x${resolution.height} with long duration ${Math.round(duration)}s — likely surveillance`,
      }
    }

    // Audio-only or short video with audio → speech likely
    if (!resolution || duration < 600) {
      return {
        category: 'SPEECH_LIKELY',
        duration,
        hasAudio: true,
        resolution,
        reason: resolution ? 'Short video with audio' : 'Audio-only file',
      }
    }

    return {
      category: 'SPEECH_POSSIBLE',
      duration,
      hasAudio: true,
      resolution,
      reason: 'Medium-duration video with audio',
    }
  } catch {
    // ffprobe not available — fall through to transcription
    return {
      category: 'SPEECH_POSSIBLE',
      duration: 0,
      hasAudio: true,
      reason: 'ffprobe unavailable — assuming audio present',
    }
  }
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

  // Pre-screen media to skip silent files
  const tempPath = join(tmpdir(), `prescreen-${audioFileId}`)
  let screenResult: MediaScreenResult | null = null
  try {
    await writeFile(tempPath, audioBuffer)
    screenResult = await prescreenMedia(tempPath)
  } catch {
    // Prescreening is best-effort
  } finally {
    try { await unlink(tempPath) } catch { /* ignore */ }
  }

  if (screenResult && (screenResult.category === 'NO_AUDIO' || screenResult.category === 'SURVEILLANCE')) {
    console.log(`[Audio] File ${audioFileId}: skipped — ${screenResult.reason}`)
    await supabase
      .from('documents')
      .update({
        metadata: {
          media_prescreen: screenResult,
          transcription_skipped: true,
          transcription_skip_reason: screenResult.reason,
        },
      })
      .eq('id', audioFileId)
    return
  }

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
        ...(screenResult ? { media_prescreen: screenResult } : {}),
      },
    })
    .eq('id', audioFileId)

  console.log(
    `[Audio] File ${audioFileId}: transcribed ${transcript.length} chars, ${segments.length} segments`
  )
}

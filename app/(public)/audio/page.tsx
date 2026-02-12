// app/(public)/audio/page.tsx
'use client'

import { AudioPlaylist } from '@/components/browse/AudioPlaylist'
import { AudioPlayer } from '@/components/browse/AudioPlayer'
import { EmptyState } from '@/components/shared/EmptyState'

export default function AudioPage() {
  // Will fetch from API in Phase 4
  const audioFiles: Array<{
    id: string
    filename: string
    duration_seconds: number | null
    transcript: string | null
    dataset_name: string | null
  }> = []

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
      <h1 className="mb-6 text-3xl font-bold">Audio Archive</h1>
      <p className="mb-8 text-muted-foreground">
        Court recordings, depositions, and other audio from the Epstein files.
        Each recording includes a searchable AI-generated transcript.
      </p>
      {audioFiles.length > 0 ? (
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="flex-1">
            <AudioPlaylist files={audioFiles} />
          </div>
          <div className="lg:w-96">
            <AudioPlayer />
          </div>
        </div>
      ) : (
        <EmptyState
          variant="not-processed"
          title="Audio Archive"
          description="Audio files will appear here as they are transcribed and processed. This includes court recordings, depositions, and other audio evidence."
          showFundingCTA
        />
      )}
    </div>
  )
}

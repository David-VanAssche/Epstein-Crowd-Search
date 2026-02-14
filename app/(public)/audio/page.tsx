// app/(public)/audio/page.tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import { AudioPlaylist } from '@/components/browse/AudioPlaylist'
import { AudioPlayer } from '@/components/browse/AudioPlayer'
import { ProcessingFundingCard } from '@/components/funding/ProcessingFundingCard'
import { LoadingState } from '@/components/shared/LoadingState'
import { fetchPaginated } from '@/lib/api/client'

interface AudioFileItem {
  id: string
  filename: string
  duration_seconds: number | null
  transcript: string | null
  dataset_name: string | null
  storage_path?: string
}

export default function AudioPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['audio-files'],
    queryFn: () => fetchPaginated<AudioFileItem>('/api/audio?per_page=50'),
    staleTime: 60_000,
  })

  const audioFiles = data?.items ?? []

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
      <h1 className="mb-6 text-3xl font-bold">Audio Archive</h1>
      <p className="mb-8 text-muted-foreground">
        Court recordings, depositions, and other audio from the Epstein files.
        Each recording includes a searchable AI-generated transcript.
      </p>
      {isLoading ? (
        <LoadingState variant="list" count={5} />
      ) : audioFiles.length > 0 ? (
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="flex-1">
            <AudioPlaylist files={audioFiles} />
          </div>
          <div className="lg:w-96">
            <AudioPlayer />
          </div>
        </div>
      ) : (
        <ProcessingFundingCard slug="audio" />
      )}
    </div>
  )
}

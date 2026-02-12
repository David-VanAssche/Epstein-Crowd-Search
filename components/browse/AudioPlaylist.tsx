// components/browse/AudioPlaylist.tsx
import { Card, CardContent } from '@/components/ui/card'

interface AudioFile {
  id: string
  filename: string
  duration_seconds: number | null
  transcript: string | null
  dataset_name: string | null
}

interface AudioPlaylistProps {
  files: AudioFile[]
}

export function AudioPlaylist({ files }: AudioPlaylistProps) {
  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--:--'
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="space-y-2">
      {files.map((file) => (
        <Card key={file.id} className="cursor-pointer border-border bg-surface transition-colors hover:bg-surface-elevated">
          <CardContent className="flex items-center gap-4 py-3">
            <span className="text-lg">🎧</span>
            <div className="flex-1">
              <p className="text-sm font-medium">{file.filename}</p>
              {file.dataset_name && (
                <p className="text-xs text-muted-foreground">{file.dataset_name}</p>
              )}
            </div>
            <span className="text-xs text-muted-foreground">{formatDuration(file.duration_seconds)}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

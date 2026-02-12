// components/search/AudioResult.tsx
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface AudioResultProps {
  id: string
  content: string
  filename: string | null
  datasetName: string | null
  timestampStart?: number
  timestampEnd?: number
  speakerLabel?: string
}

export function AudioResult({ content, filename, datasetName, speakerLabel }: AudioResultProps) {
  return (
    <Card className="border-border bg-surface">
      <CardContent className="pt-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-sm">🎧</span>
          <span className="text-sm font-medium text-primary">{filename || 'Audio'}</span>
          {speakerLabel && <Badge variant="outline" className="text-xs">{speakerLabel}</Badge>}
        </div>
        <p className="line-clamp-3 font-mono text-sm text-muted-foreground">{content}</p>
        {datasetName && <Badge variant="secondary" className="mt-2 text-xs">{datasetName}</Badge>}
      </CardContent>
    </Card>
  )
}

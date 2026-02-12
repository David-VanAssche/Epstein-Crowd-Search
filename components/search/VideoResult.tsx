// components/search/VideoResult.tsx
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface VideoResultProps {
  id: string
  content: string
  filename: string | null
  datasetName: string | null
  timestampStart?: number
  timestampEnd?: number
}

export function VideoResult({ content, filename, datasetName }: VideoResultProps) {
  return (
    <Card className="border-border bg-surface">
      <CardContent className="pt-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-sm font-medium text-primary">{filename || 'Video'}</span>
        </div>
        <p className="line-clamp-3 font-mono text-sm text-muted-foreground">{content}</p>
        {datasetName && <Badge variant="secondary" className="mt-2 text-xs">{datasetName}</Badge>}
      </CardContent>
    </Card>
  )
}

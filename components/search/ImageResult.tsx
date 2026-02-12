// components/search/ImageResult.tsx
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface ImageResultProps {
  id: string
  storagePath: string | null
  description: string | null
  filename: string | null
  datasetName: string | null
  documentId: string | null
}

export function ImageResult({ description, filename, datasetName }: ImageResultProps) {
  return (
    <Card className="border-border bg-surface">
      <CardContent className="pt-4">
        <div className="mb-2 aspect-video rounded bg-surface-elevated" />
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {description || filename || 'Image'}
        </p>
        {datasetName && <Badge variant="secondary" className="mt-2 text-xs">{datasetName}</Badge>}
      </CardContent>
    </Card>
  )
}

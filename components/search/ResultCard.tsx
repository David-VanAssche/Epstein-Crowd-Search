// components/search/ResultCard.tsx
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface ResultCardProps {
  chunkId: string
  documentId: string
  content: string
  contextualHeader: string | null
  pageNumber: number | null
  documentFilename: string
  documentClassification: string | null
  datasetName: string | null
  rrfScore: number
}

export function ResultCard({
  documentId,
  content,
  contextualHeader,
  pageNumber,
  documentFilename,
  documentClassification,
  datasetName,
}: ResultCardProps) {
  return (
    <Link href={`/document/${documentId}${pageNumber ? `#page-${pageNumber}` : ''}`}>
      <Card className="border-border bg-surface transition-colors hover:bg-surface-elevated">
        <CardContent className="pt-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-sm font-medium text-primary">{documentFilename}</span>
            {pageNumber && (
              <span className="text-xs text-muted-foreground">p. {pageNumber}</span>
            )}
          </div>
          {contextualHeader && (
            <p className="mb-1 text-xs text-muted-foreground">{contextualHeader}</p>
          )}
          <p className="line-clamp-3 text-sm text-muted-foreground">{content}</p>
          <div className="mt-3 flex gap-2">
            {documentClassification && (
              <Badge variant="outline" className="text-xs">{documentClassification}</Badge>
            )}
            {datasetName && (
              <Badge variant="secondary" className="text-xs">{datasetName}</Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

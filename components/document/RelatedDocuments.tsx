// components/document/RelatedDocuments.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface RelatedDocumentsProps {
  documentId: string
}

export function RelatedDocuments({ documentId }: RelatedDocumentsProps) {
  // Will fetch from /api/document/{id}/similar in Phase 4
  return (
    <Card className="border-border bg-surface">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Related Documents</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">
          Similar documents will appear here once processing is complete.
        </p>
      </CardContent>
    </Card>
  )
}

// components/document/DocumentMetadata.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

interface DocumentMetadataProps {
  document: {
    filename: string
    classification: string | null
    dataset_name: string | null
    page_count: number | null
    date_extracted: string | null
    is_redacted: boolean
  }
}

export function DocumentMetadata({ document }: DocumentMetadataProps) {
  return (
    <Card className="border-border bg-surface">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Document Info</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>
          <span className="text-muted-foreground">Filename:</span>
          <p className="font-mono text-xs">{document.filename}</p>
        </div>
        <Separator />
        {document.classification && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Type:</span>
            <Badge variant="outline">{document.classification}</Badge>
          </div>
        )}
        {document.dataset_name && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Dataset:</span>
            <Badge variant="secondary">{document.dataset_name}</Badge>
          </div>
        )}
        {document.page_count && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Pages:</span>
            <span>{document.page_count}</span>
          </div>
        )}
        {document.date_extracted && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Date:</span>
            <span>{new Date(document.date_extracted).toLocaleDateString()}</span>
          </div>
        )}
        {document.is_redacted && (
          <Badge className="bg-accent/10 text-accent">Contains Redactions</Badge>
        )}
      </CardContent>
    </Card>
  )
}

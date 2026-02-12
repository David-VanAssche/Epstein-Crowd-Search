// components/document/DocumentSummary.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface DocumentSummaryProps {
  document: {
    filename: string
    classification: string | null
    metadata: Record<string, unknown>
  }
}

export function DocumentSummary({ document }: DocumentSummaryProps) {
  // AI summary will be populated by batch processing pipeline in Phase 6
  return (
    <Card className="border-border bg-surface">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Executive Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm italic text-muted-foreground">
          AI-generated summary will appear here once this document is fully processed.
        </p>
      </CardContent>
    </Card>
  )
}

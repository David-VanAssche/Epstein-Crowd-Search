// components/document/DocumentCompleteness.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

interface DocumentCompletenessProps {
  documentId: string
}

const REVIEW_TYPES = [
  { id: 'ocr_verified', label: 'OCR text verified' },
  { id: 'entities_confirmed', label: 'Entities confirmed' },
  { id: 'dates_validated', label: 'Dates validated' },
  { id: 'redactions_attempted', label: 'Redactions attempted' },
  { id: 'cross_references_checked', label: 'Cross-references checked' },
]

export function DocumentCompleteness({ documentId }: DocumentCompletenessProps) {
  return (
    <Card className="border-border bg-surface">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Review Checklist</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {REVIEW_TYPES.map((type) => (
          <div key={type.id} className="flex items-center gap-2">
            <Checkbox id={type.id} disabled />
            <Label htmlFor={type.id} className="text-xs text-muted-foreground">{type.label}</Label>
          </div>
        ))}
        <p className="mt-2 text-xs text-muted-foreground">
          Sign in to help review this document.
        </p>
      </CardContent>
    </Card>
  )
}

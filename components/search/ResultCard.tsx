// components/search/ResultCard.tsx
import Link from 'next/link'
import {
  FileText,
  Plane,
  Scale,
  FileWarning,
  DollarSign,
  Mail,
  Gavel,
  Shield,
  Image,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const DOC_TYPE_ICONS: Record<string, LucideIcon> = {
  flight_log: Plane,
  deposition: Scale,
  fbi_302: FileWarning,
  financial: DollarSign,
  email: Mail,
  correspondence: Mail,
  court_filing: Gavel,
  police_report: Shield,
  photo: Image,
}

const DOC_TYPE_COLORS: Record<string, string> = {
  flight_log: 'text-amber-400 border-amber-400/30',
  fbi_302: 'text-red-400 border-red-400/30',
  deposition: 'text-blue-400 border-blue-400/30',
  financial: 'text-green-400 border-green-400/30',
  court_filing: 'text-purple-400 border-purple-400/30',
}

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
  const classification = documentClassification?.toLowerCase().replace(/\s+/g, '_') ?? ''
  const DocIcon = DOC_TYPE_ICONS[classification] ?? FileText
  const badgeColor = DOC_TYPE_COLORS[classification] ?? ''

  return (
    <Link href={`/document/${documentId}${pageNumber ? `#page-${pageNumber}` : ''}`}>
      <Card className="border-border bg-surface transition-colors hover:bg-surface-elevated">
        <CardContent className="pt-4">
          <div className="mb-2 flex items-center gap-2">
            <DocIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
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
              <Badge
                variant="outline"
                className={`text-xs ${badgeColor}`}
              >
                {documentClassification}
              </Badge>
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

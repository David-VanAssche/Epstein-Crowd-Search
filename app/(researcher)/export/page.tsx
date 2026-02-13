// app/(researcher)/export/page.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const EXPORT_FORMATS = [
  { format: 'CSV', description: 'Spreadsheet-compatible data export. Entities, relationships, timeline events, and document metadata.' },
  { format: 'JSON', description: 'Structured data export for programmatic access. Full entity graphs, relationship maps, and document metadata.' },
  { format: 'GraphML', description: 'Graph markup language for network analysis tools like Gephi, Cytoscape, or Neo4j.' },
  { format: 'PDF Evidence Package', description: 'Formatted evidence reports with citations, entity summaries, and relationship diagrams for legal use.' },
]

export default function ExportPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 lg:px-8">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">Data Export</h1>
          <Badge variant="outline" className="text-amber-400 border-amber-400/30">Coming Soon</Badge>
        </div>
        <p className="mt-2 text-muted-foreground">
          Bulk data export for researchers and prosecutors. Download entity data, relationship graphs,
          timeline events, and document metadata in multiple formats.
        </p>
      </div>

      <Card className="mb-8 border-amber-500/20 bg-amber-500/5">
        <CardContent className="pt-6">
          <p className="text-sm text-amber-400">
            Data export requires the Researcher tier ($9/month). This helps cover the bandwidth and
            compute costs of generating large data exports. All revenue goes directly to document processing.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {EXPORT_FORMATS.map(({ format, description }) => (
          <Card key={format} className="border-border bg-surface">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">{format}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-muted-foreground">{description}</p>
              <Button variant="outline" size="sm" disabled>
                Coming Soon
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

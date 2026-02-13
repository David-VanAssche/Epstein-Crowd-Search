// app/(public)/prosecutors/page.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export const metadata = {
  title: 'For Prosecutors & Legal Professionals — Epstein Files',
  description: 'Prosecutor-ready evidence summaries, entity dossiers, and exportable evidence packages from the Epstein document archive.',
}

export default function ProsecutorsPage() {
  const topEntities: Array<{
    name: string
    entity_type: string
    citation_count: number
    document_count: number
    relationship_strength: number
  }> = []

  const flaggedDocuments: Array<{
    id: string
    filename: string
    criminal_indicator_score: number
    categories: string[]
  }> = []

  const criminalCategories: Array<{
    category: string
    document_count: number
    description: string
  }> = []

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <section className="mb-8">
        <Badge variant="outline" className="mb-4">For Law Enforcement & Legal Professionals</Badge>
        <h1 className="mb-4 text-4xl font-bold tracking-tight">
          Prosecutor Dashboard
        </h1>
        <p className="max-w-3xl text-lg text-muted-foreground">
          AI-extracted evidence summaries from the Epstein document corpus. All findings are
          derived from publicly available DOJ documents and are cross-referenced for accuracy.
          This dashboard is designed to surface actionable intelligence for legal professionals.
        </p>
      </section>

      <Separator className="my-8" />

      {/* Per-entity evidence summaries */}
      <section className="mb-8">
        <h2 className="mb-4 text-2xl font-bold">Entity Evidence Summaries</h2>
        <p className="mb-6 text-muted-foreground">
          Entities ranked by number of document citations and relationship strength.
        </p>
        {topEntities.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entity</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Citations</TableHead>
                  <TableHead>Documents</TableHead>
                  <TableHead>Relationship Strength</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topEntities.map((entity) => (
                  <TableRow key={entity.name}>
                    <TableCell className="font-medium">{entity.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{entity.entity_type}</Badge>
                    </TableCell>
                    <TableCell>{entity.citation_count}</TableCell>
                    <TableCell>{entity.document_count}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-20 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-red-500"
                            style={{ width: `${entity.relationship_strength}%` }}
                          />
                        </div>
                        <span className="text-xs">{entity.relationship_strength}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm">View Dossier</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <Card className="border-border bg-surface">
            <CardContent className="flex h-32 items-center justify-center">
              <p className="text-sm text-muted-foreground">
                Entity evidence summaries will populate as documents are processed and entities are extracted.
              </p>
            </CardContent>
          </Card>
        )}
      </section>

      <Separator className="my-8" />

      {/* Criminal activity indicators */}
      <section className="mb-8">
        <h2 className="mb-4 text-2xl font-bold">Criminal Activity Indicators</h2>
        <p className="mb-6 text-muted-foreground">
          Documents flagged by AI for potential criminal activity indicators, organized by category.
        </p>
        {criminalCategories.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {criminalCategories.map((cat) => (
              <Card key={cat.category} className="border-border bg-surface">
                <CardContent className="pt-6">
                  <h3 className="mb-1 font-semibold">{cat.category}</h3>
                  <p className="mb-2 text-xs text-muted-foreground">{cat.description}</p>
                  <p className="text-2xl font-bold text-accent">{cat.document_count}</p>
                  <p className="text-xs text-muted-foreground">flagged documents</p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-border bg-surface">
            <CardContent className="flex h-32 items-center justify-center">
              <p className="text-sm text-muted-foreground">
                Criminal activity categories will be populated as AI analysis progresses.
              </p>
            </CardContent>
          </Card>
        )}
      </section>

      <Separator className="my-8" />

      {/* Most-flagged documents */}
      <section className="mb-8">
        <h2 className="mb-4 text-2xl font-bold">Most-Flagged Documents</h2>
        <p className="mb-6 text-muted-foreground">
          Documents with the highest criminal indicator scores, ranked by severity.
        </p>
        {flaggedDocuments.length > 0 ? (
          <div className="space-y-3">
            {flaggedDocuments.map((doc) => (
              <Card key={doc.id} className="border-border bg-surface">
                <CardContent className="flex items-center justify-between pt-4">
                  <div>
                    <p className="font-medium">{doc.filename}</p>
                    <div className="mt-1 flex gap-2">
                      {doc.categories.map((cat) => (
                        <Badge key={cat} variant="secondary" className="text-xs">{cat}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-red-400">{doc.criminal_indicator_score}</div>
                    <p className="text-xs text-muted-foreground">indicator score</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-border bg-surface">
            <CardContent className="flex h-32 items-center justify-center">
              <p className="text-sm text-muted-foreground">
                Flagged documents will appear once criminal indicator scoring is complete.
              </p>
            </CardContent>
          </Card>
        )}
      </section>

      <Separator className="my-8" />

      {/* Export + Verification */}
      <section className="mb-8 grid gap-6 lg:grid-cols-2">
        <Card className="border-border bg-surface">
          <CardHeader>
            <CardTitle>Export Full Evidence Package</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Generate a comprehensive evidence package including entity dossiers, document citations,
              relationship maps, and timeline reconstructions. Formatted for legal proceedings.
            </p>
            <Button disabled>
              Export Evidence Package (PDF)
            </Button>
            <p className="text-xs text-muted-foreground">
              Export will be available once sufficient evidence has been processed and verified.
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-surface">
          <CardHeader>
            <CardTitle>Verification & Chain of Custody</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              All documents in this archive are sourced from official U.S. Department of Justice releases.
              AI-extracted entities and relationships should be independently verified before use in legal proceedings.
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 text-green-400">&#10003;</span>
                <span>Source documents are from official DOJ releases</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-0.5 text-green-400">&#10003;</span>
                <span>OCR text is verified by community contributors</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-0.5 text-amber-400">&#9888;</span>
                <span>AI-extracted entities require independent verification</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-0.5 text-amber-400">&#9888;</span>
                <span>Crowdsourced redaction solutions are consensus-based</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Contact */}
      <section className="mb-8">
        <Card className="border-border bg-surface">
          <CardContent className="pt-6 text-center">
            <h3 className="mb-2 text-lg font-semibold">Legal Inquiries</h3>
            <p className="text-sm text-muted-foreground">
              For law enforcement or legal professionals seeking to verify findings or request
              additional analysis, please contact us through the appropriate legal channels.
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              Email: <span className="text-foreground">legal@epsteinfiles.org</span> (placeholder)
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

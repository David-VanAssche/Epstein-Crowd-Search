// app/(public)/prosecutors/page.tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2, Info } from 'lucide-react'
import { RiskScoreBadge } from '@/components/entity/RiskScoreBadge'
import { fetchPaginated } from '@/lib/api/client'

interface RankedEntity {
  id: string
  name: string
  entity_type: string
  mention_count: number
  document_count: number
  risk_score: number
}

function useTopEntities() {
  return useQuery({
    queryKey: ['prosecutors-top-entities'],
    queryFn: () =>
      fetchPaginated<RankedEntity>('/api/entity?per_page=50&type=person'),
    staleTime: 60_000,
  })
}

export default function ProsecutorsPage() {
  const { data: entityData, isLoading: entitiesLoading, error: entitiesError } = useTopEntities()

  const topEntities = (entityData?.items ?? [])
    .filter((e) => e.risk_score > 0)
    .sort((a, b) => b.risk_score - a.risk_score)

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
          Persons ranked by algorithmic risk score. Only entities with evidence-backed scores appear here.
        </p>
        {entitiesError ? (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
            Failed to load entity data. Please try again later.
          </div>
        ) : entitiesLoading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : topEntities.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entity</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Mentions</TableHead>
                  <TableHead>Documents</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topEntities.map((entity) => (
                  <TableRow key={entity.id}>
                    <TableCell className="font-medium">{entity.name}</TableCell>
                    <TableCell>
                      <RiskScoreBadge score={entity.risk_score} />
                    </TableCell>
                    <TableCell>{entity.mention_count}</TableCell>
                    <TableCell>{entity.document_count}</TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/entity/${entity.id}`}>View Dossier</Link>
                      </Button>
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
                Entity evidence summaries will populate as documents are processed and risk scores are computed.
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { category: 'Trafficking', description: 'Evidence of human trafficking, recruitment, or transportation of minors' },
            { category: 'Obstruction', description: 'Evidence of witness intimidation, evidence tampering, or obstruction of justice' },
            { category: 'Conspiracy', description: 'Evidence of coordinated criminal activity between multiple parties' },
            { category: 'Financial Crimes', description: 'Evidence of money laundering, tax evasion, or fraudulent transactions' },
            { category: 'Witness Tampering', description: 'Evidence of attempts to influence or intimidate witnesses' },
            { category: 'Exploitation', description: 'Evidence of sexual exploitation or abuse' },
          ].map((cat) => (
            <Card key={cat.category} className="border-border bg-surface">
              <CardContent className="pt-6">
                <h3 className="mb-1 font-semibold">{cat.category}</h3>
                <p className="text-xs text-muted-foreground">{cat.description}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Counts will populate after criminal indicator scoring completes.
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Separator className="my-8" />

      {/* Most-flagged documents */}
      <section className="mb-8">
        <h2 className="mb-4 text-2xl font-bold">Most-Flagged Documents</h2>
        <p className="mb-6 text-muted-foreground">
          Documents with the highest criminal indicator scores, ranked by severity.
        </p>
        <Card className="border-border bg-surface">
          <CardContent className="flex h-32 items-center justify-center">
            <p className="text-sm text-muted-foreground">
              Flagged documents will appear once criminal indicator scoring is complete.
            </p>
          </CardContent>
        </Card>
      </section>

      <Separator className="my-8" />

      {/* Risk Methodology Transparency */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Info className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-2xl font-bold">Risk Scoring Methodology</h2>
        </div>
        <Card className="border-border bg-surface">
          <CardContent className="pt-6 space-y-4 text-sm">
            <p className="text-muted-foreground">
              Risk scores (0-5) are computed algorithmically from three components. These scores are
              <strong> not editorial judgments</strong> &mdash; they are mathematical aggregations of
              evidence quality, documented relationships, and criminal indicators found in DOJ documents.
            </p>

            <div className="space-y-3">
              <div>
                <h4 className="font-semibold">Evidence Score (max 2.0)</h4>
                <p className="text-muted-foreground">
                  Based on the quality and quantity of document mentions. Sworn testimony (depositions,
                  grand jury) weighs 10x more than peripheral mentions (address book entries, photographs).
                  Only the top 20 strongest documents count, preventing inflation from bulk mentions.
                </p>
              </div>

              <div>
                <h4 className="font-semibold">Relationship Score (max 1.5)</h4>
                <p className="text-muted-foreground">
                  Only 6 of 20 relationship types contribute: victim_of, recruited_by, co_defendant,
                  witness_testimony, financial_connection, and traveled_with. The other 14 types
                  (associate_of, family_member, guest_of, employer_of, etc.) contribute <strong>zero</strong>.
                  This is the guilt-by-association firewall &mdash; merely knowing someone does not increase their score.
                </p>
              </div>

              <div>
                <h4 className="font-semibold">Indicator Score (max 1.5)</h4>
                <p className="text-muted-foreground">
                  Aggregates criminal indicators (trafficking, obstruction, conspiracy, financial crimes,
                  witness tampering, exploitation) from documents where the entity is mentioned.
                  Indicators are weighted by mention quality &mdash; a co-occurrence mention in a
                  trafficking document gets only 15% attribution.
                </p>
              </div>
            </div>

            <div>
              <h4 className="font-semibold">Anti-Guilt-by-Association Safeguards</h4>
              <ul className="mt-1 space-y-1 text-muted-foreground list-disc list-inside">
                <li>14 of 20 relationship types contribute zero to risk score</li>
                <li>Address book mentions heavily discounted (0.1 document tier x 0.15 co-occurrence = 0.015 weight)</li>
                <li>Per-document dedup: appearing 50 times in one document counts the same as once</li>
                <li>Top-20 document cap prevents inflation from bulk mentions</li>
                <li>Criminal indicators discounted by mention quality</li>
                <li>All risk factors are fully transparent and auditable via the entity dossier</li>
              </ul>
            </div>
          </CardContent>
        </Card>
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

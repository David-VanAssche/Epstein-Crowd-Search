// components/entity/EntityDossier.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RiskScoreBadge } from './RiskScoreBadge'
import type { Entity } from '@/types/entities'

interface EntityDossierProps {
  entity: Entity
}

export function EntityDossier({ entity }: EntityDossierProps) {
  const hasRisk = entity.risk_score > 0
  const factors = entity.risk_factors

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold">Evidence Dossier: {entity.name}</h3>
        <Button variant="outline" size="sm" disabled>
          Export Dossier (PDF)
        </Button>
      </div>

      <Card className="border-border bg-surface">
        <CardHeader><CardTitle className="text-sm">Involvement Summary</CardTitle></CardHeader>
        <CardContent>
          {hasRisk ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <RiskScoreBadge score={entity.risk_score} factors={factors} size="md" />
                <span className="text-sm text-muted-foreground">
                  Algorithmic risk score based on evidence quality, relationships, and criminal indicators
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Evidence</p>
                  <p className="text-2xl font-bold">{factors?.evidence_score?.toFixed(2) ?? '0.00'}</p>
                  <p className="text-xs text-muted-foreground">of 2.0 max</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Relationships</p>
                  <p className="text-2xl font-bold">{factors?.relationship_score?.toFixed(2) ?? '0.00'}</p>
                  <p className="text-xs text-muted-foreground">of 1.5 max</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Indicators</p>
                  <p className="text-2xl font-bold">{factors?.indicator_score?.toFixed(2) ?? '0.00'}</p>
                  <p className="text-xs text-muted-foreground">of 1.5 max</p>
                </div>
              </div>

              {factors?.indicator_categories && Object.keys(factors.indicator_categories).length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Flagged Categories</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(factors.indicator_categories).map(([cat, score]) => (
                      <Badge key={cat} variant="secondary">{cat}: {(score as number).toFixed(2)}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Auto-generated prosecutor-ready summary will appear once sufficient evidence is processed.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="border-border bg-surface">
        <CardHeader><CardTitle className="text-sm">Key Documents</CardTitle></CardHeader>
        <CardContent>
          {factors?.top_documents && factors.top_documents.length > 0 ? (
            <div className="space-y-2">
              {factors.top_documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between text-sm">
                  <span className="truncate">{doc.filename}</span>
                  <span className="ml-2 shrink-0 font-mono text-xs text-muted-foreground">
                    weight: {doc.weight.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Documents with strongest evidence connections.</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-border bg-surface">
        <CardHeader><CardTitle className="text-sm">Relationship Evidence</CardTitle></CardHeader>
        <CardContent>
          {factors?.contributing_relationships && factors.contributing_relationships.length > 0 ? (
            <div className="space-y-2">
              {factors.contributing_relationships.map((rel) => (
                <div key={`${rel.entity_name}-${rel.type}`} className="flex items-center justify-between text-sm">
                  <span>{rel.entity_name}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{rel.type}</Badge>
                    <span className="font-mono text-xs text-muted-foreground">+{rel.weight.toFixed(1)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Documented relationships and connections.</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-border bg-surface">
        <CardHeader><CardTitle className="text-sm">Timeline of Activities</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Chronological record of documented activities.</p>
        </CardContent>
      </Card>
    </div>
  )
}

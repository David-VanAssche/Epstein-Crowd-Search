// components/entity/EntityProfile.tsx
'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EntityMentions } from './EntityMentions'
import { EntityTimeline } from './EntityTimeline'
import { EntityConnections } from './EntityConnections'
import { EntityDossier } from './EntityDossier'
import { RiskScoreBadge } from './RiskScoreBadge'
import type { Entity } from '@/types/entities'

interface EntityProfileProps {
  entity: Entity
}

export function EntityProfile({ entity }: EntityProfileProps) {
  const hasRiskFactors = entity.risk_factors && entity.risk_factors.evidence_score != null

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">{entity.name}</h1>
          <Badge variant="outline">{entity.entity_type}</Badge>
          {entity.is_verified && <Badge className="bg-green-600">Verified</Badge>}
          {entity.risk_score > 0 && (
            <RiskScoreBadge score={entity.risk_score} factors={entity.risk_factors} size="md" />
          )}
        </div>
        {entity.aliases?.length > 0 && (
          <p className="mt-1 text-sm text-muted-foreground">
            Also known as: {entity.aliases.join(', ')}
          </p>
        )}
        <div className="mt-2 flex gap-4 text-sm text-muted-foreground">
          <span>{entity.mention_count} mentions</span>
          <span>{entity.document_count} documents</span>
          {entity.first_seen_date && <span>First seen: {new Date(entity.first_seen_date).toLocaleDateString()}</span>}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="connections">Connections</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="redactions">Redactions</TabsTrigger>
          <TabsTrigger value="dossier">Evidence Dossier</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          <p className="text-muted-foreground">
            {entity.description || 'AI-generated summary will appear once this entity is fully analyzed.'}
          </p>

          {/* Risk Assessment Section */}
          {hasRiskFactors && (
            <Card className="border-border bg-surface">
              <CardHeader>
                <CardTitle className="text-sm">Risk Assessment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Evidence Score</p>
                    <p className="text-lg font-bold">{entity.risk_factors.evidence_score?.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">max 2.0</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Relationship Score</p>
                    <p className="text-lg font-bold">{entity.risk_factors.relationship_score?.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">max 1.5</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Indicator Score</p>
                    <p className="text-lg font-bold">{entity.risk_factors.indicator_score?.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">max 1.5</p>
                  </div>
                </div>

                {entity.risk_factors.top_documents && entity.risk_factors.top_documents.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Top Evidence Documents</p>
                    <div className="space-y-1">
                      {entity.risk_factors.top_documents.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between text-sm">
                          <span className="truncate">{doc.filename}</span>
                          <span className="ml-2 shrink-0 font-mono text-xs text-muted-foreground">
                            {doc.weight.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {entity.risk_factors.contributing_relationships && entity.risk_factors.contributing_relationships.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Contributing Relationships</p>
                    <div className="space-y-1">
                      {entity.risk_factors.contributing_relationships.map((rel) => (
                        <div key={`${rel.entity_name}-${rel.type}`} className="flex items-center justify-between text-sm">
                          <span>{rel.type}: {rel.entity_name}</span>
                          <span className="ml-2 shrink-0 font-mono text-xs text-muted-foreground">
                            +{rel.weight.toFixed(1)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {entity.risk_factors.indicator_categories && Object.keys(entity.risk_factors.indicator_categories).length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Criminal Indicator Categories</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(entity.risk_factors.indicator_categories).map(([category, score]) => (
                        <Badge key={category} variant="secondary" className="text-xs">
                          {category}: {(score as number).toFixed(2)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {entity.risk_score_updated_at && (
                  <p className="text-xs text-muted-foreground">
                    Last updated: {new Date(entity.risk_score_updated_at).toLocaleString()}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="documents" className="mt-6">
          <EntityMentions entityId={entity.id} />
        </TabsContent>

        <TabsContent value="connections" className="mt-6">
          <EntityConnections entityId={entity.id} entityName={entity.name} />
        </TabsContent>

        <TabsContent value="timeline" className="mt-6">
          <EntityTimeline entityId={entity.id} />
        </TabsContent>

        <TabsContent value="redactions" className="mt-6">
          <p className="text-sm text-muted-foreground">
            Redactions where this entity may be the hidden text will appear here.
          </p>
        </TabsContent>

        <TabsContent value="dossier" className="mt-6">
          <EntityDossier entity={entity} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

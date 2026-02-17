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
import {
  Phone, MapPin, Mail, Building2, BookOpen,
  FileText, Network, Clock, ShieldAlert, FileSearch,
  Lock,
} from 'lucide-react'
import type { Entity } from '@/types/entities'

interface EntityProfileProps {
  entity: Entity
}

function PendingSection({ icon: Icon, title, description }: {
  icon: React.ElementType
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/60 bg-muted/5 px-6 py-10 text-center">
      <Icon className="mb-3 h-8 w-8 text-muted-foreground/40" />
      <p className="mb-1 text-sm font-medium text-muted-foreground/70">{title}</p>
      <p className="max-w-sm text-xs text-muted-foreground/50">{description}</p>
    </div>
  )
}

function ContactInfoCard({ entity }: { entity: Entity }) {
  const meta = (entity.metadata || {}) as Record<string, any>
  const phones: string[] = meta.phones || []
  const addresses: string[] = meta.addresses || []
  const emails: string[] = meta.emails || []
  const companies: string[] = meta.companies || []
  const pages: string[] = meta.blackbook_pages || []

  const hasContactInfo = phones.length > 0 || addresses.length > 0 || emails.length > 0 || companies.length > 0

  if (!hasContactInfo) return null

  return (
    <Card className="border-border bg-surface">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <BookOpen className="h-4 w-4" />
          Black Book Entry
          {pages.length > 0 && (
            <span className="text-xs font-normal text-muted-foreground">
              Page {pages.join(', ')}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {phones.length > 0 && (
          <div className="flex items-start gap-2.5">
            <Phone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="space-y-0.5">
              {phones.map((phone, i) => (
                <p key={i} className="text-sm">{phone}</p>
              ))}
            </div>
          </div>
        )}
        {addresses.length > 0 && (
          <div className="flex items-start gap-2.5">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="space-y-0.5">
              {addresses.map((addr, i) => (
                <p key={i} className="text-sm">{addr}</p>
              ))}
            </div>
          </div>
        )}
        {emails.length > 0 && (
          <div className="flex items-start gap-2.5">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="space-y-0.5">
              {emails.map((email, i) => (
                <p key={i} className="text-sm">{email}</p>
              ))}
            </div>
          </div>
        )}
        {companies.length > 0 && (
          <div className="flex items-start gap-2.5">
            <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="space-y-0.5">
              {companies.map((co, i) => (
                <p key={i} className="text-sm">{co}</p>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function EntityProfile({ entity }: EntityProfileProps) {
  const hasRiskFactors = entity.risk_factors && entity.risk_factors.evidence_score != null
  const hasDescription = !!entity.description
  const hasMentions = entity.mention_count > 0
  const hasDocs = entity.document_count > 0
  const meta = (entity.metadata || {}) as Record<string, any>
  const hasContactInfo = (meta.phones?.length > 0) || (meta.addresses?.length > 0) || (meta.emails?.length > 0) || (meta.companies?.length > 0)

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
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {hasMentions && <span>{entity.mention_count} mentions</span>}
          {hasDocs && <span>{entity.document_count} documents</span>}
          {entity.first_seen_date && <span>First seen: {new Date(entity.first_seen_date).toLocaleDateString()}</span>}
          {!hasMentions && !hasDocs && !entity.first_seen_date && (
            <span>Awaiting document analysis</span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="documents">
            Documents
            {hasDocs && <span className="ml-1.5 text-xs text-muted-foreground">({entity.document_count})</span>}
          </TabsTrigger>
          <TabsTrigger value="connections">Connections</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="redactions">Redactions</TabsTrigger>
          <TabsTrigger value="dossier">Dossier</TabsTrigger>
        </TabsList>

        {/* ── Overview Tab ────────────────────────────────── */}
        <TabsContent value="overview" className="mt-6 space-y-6">

          {/* Contact Information (from blackbook metadata) */}
          <ContactInfoCard entity={entity} />

          {/* AI Summary */}
          <Card className="border-border bg-surface">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <FileSearch className="h-4 w-4" />
                AI Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              {hasDescription ? (
                <p className="text-sm leading-relaxed">{entity.description}</p>
              ) : (
                <p className="text-sm italic text-muted-foreground/60">
                  An AI-generated profile summary will appear here once this entity&apos;s document mentions have been analyzed. This will include a narrative overview of their role, documented activities, and connections within the Epstein case.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Risk Assessment */}
          <Card className="border-border bg-surface">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <ShieldAlert className="h-4 w-4" />
                Risk Assessment
              </CardTitle>
            </CardHeader>
            <CardContent>
              {hasRiskFactors ? (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border border-border p-3">
                      <p className="text-xs text-muted-foreground">Evidence Score</p>
                      <p className="text-lg font-bold">{entity.risk_factors.evidence_score?.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">max 2.0</p>
                    </div>
                    <div className="rounded-lg border border-border p-3">
                      <p className="text-xs text-muted-foreground">Relationship Score</p>
                      <p className="text-lg font-bold">{entity.risk_factors.relationship_score?.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">max 1.5</p>
                    </div>
                    <div className="rounded-lg border border-border p-3">
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
                </div>
              ) : (
                <p className="text-sm italic text-muted-foreground/60">
                  A composite risk score (0&ndash;5) will be computed once document mentions and relationship data are available. Scores are based on evidence quality, relationship proximity, and criminal indicator analysis.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Quick stats - what's available vs pending */}
          <Card className="border-border bg-surface">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Enrichment Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <StatusRow label="Contact information" done={hasContactInfo} detail={hasContactInfo ? 'From black book' : undefined} />
                <StatusRow label="AI summary" done={hasDescription} />
                <StatusRow label="Document mentions" done={hasMentions} detail={hasMentions ? `${entity.mention_count} found` : undefined} />
                <StatusRow label="Risk score" done={entity.risk_score > 0} detail={entity.risk_score > 0 ? `${entity.risk_score.toFixed(1)} / 5.0` : undefined} />
                <StatusRow label="Connection mapping" done={false} />
                <StatusRow label="Timeline extraction" done={false} />
                <StatusRow label="Redaction analysis" done={false} />
                <StatusRow label="Evidence dossier" done={hasRiskFactors} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Documents Tab ───────────────────────────────── */}
        <TabsContent value="documents" className="mt-6">
          {hasMentions ? (
            <EntityMentions entityId={entity.id} />
          ) : (
            <PendingSection
              icon={FileText}
              title="Document Mentions Pending"
              description="Once document text is analyzed by the NLP pipeline, every mention of this entity across all 1.4M+ documents will appear here with source context, page numbers, and confidence scores."
            />
          )}
        </TabsContent>

        {/* ── Connections Tab ─────────────────────────────── */}
        <TabsContent value="connections" className="mt-6">
          <EntityConnections entityId={entity.id} entityName={entity.name} />
        </TabsContent>

        {/* ── Timeline Tab ────────────────────────────────── */}
        <TabsContent value="timeline" className="mt-6">
          <PendingSection
            icon={Clock}
            title="Timeline Pending"
            description="A chronological timeline of this entity's documented activities will be generated from dated references in court filings, flight logs, financial records, and correspondence."
          />
        </TabsContent>

        {/* ── Redactions Tab ──────────────────────────────── */}
        <TabsContent value="redactions" className="mt-6">
          <PendingSection
            icon={Lock}
            title="Redaction Analysis Pending"
            description="AI-powered analysis will identify redacted sections across all documents where this entity may be the hidden subject, based on contextual clues, document structure, and surrounding text patterns."
          />
        </TabsContent>

        {/* ── Dossier Tab ─────────────────────────────────── */}
        <TabsContent value="dossier" className="mt-6">
          <EntityDossier entity={entity} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function StatusRow({ label, done, detail }: { label: string; done: boolean; detail?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`h-2 w-2 shrink-0 rounded-full ${done ? 'bg-green-500' : 'bg-zinc-600'}`} />
      <span className={done ? 'text-foreground' : 'text-muted-foreground/60'}>
        {label}
      </span>
      {detail && (
        <span className="ml-auto text-xs text-muted-foreground">{detail}</span>
      )}
      {!done && (
        <span className="ml-auto text-xs text-muted-foreground/40">Pending</span>
      )}
    </div>
  )
}

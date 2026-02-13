// components/entity/EntityProfile.tsx
'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { EntityMentions } from './EntityMentions'
import { EntityTimeline } from './EntityTimeline'
import { EntityConnections } from './EntityConnections'
import { EntityDossier } from './EntityDossier'
import type { Entity } from '@/types/entities'

interface EntityProfileProps {
  entity: Entity
}

export function EntityProfile({ entity }: EntityProfileProps) {
  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">{entity.name}</h1>
          <Badge variant="outline">{entity.entity_type}</Badge>
          {entity.is_verified && <Badge className="bg-green-600">Verified</Badge>}
        </div>
        {entity.aliases.length > 0 && (
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

        <TabsContent value="overview" className="mt-6">
          <p className="text-muted-foreground">
            {entity.description || 'AI-generated summary will appear once this entity is fully analyzed.'}
          </p>
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

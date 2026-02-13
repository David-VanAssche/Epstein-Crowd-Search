// components/entity/EntityConnections.tsx
'use client'

import dynamic from 'next/dynamic'
import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { LoadingState } from '@/components/shared/LoadingState'
import { EmptyState } from '@/components/shared/EmptyState'
import Link from 'next/link'
import type { GraphNode, GraphEdge, GraphFilters } from '@/types/graph'

const RelationshipGraph = dynamic(
  () => import('@/components/graph/RelationshipGraph').then(mod => ({ default: mod.RelationshipGraph })),
  {
    ssr: false,
    loading: () => <LoadingState variant="inline" />,
  }
)

interface EntityConnectionsProps {
  entityId: string
  entityName: string
}

export function EntityConnections({ entityId, entityName }: EntityConnectionsProps) {
  const [nodes, setNodes] = useState<GraphNode[]>([])
  const [edges, setEdges] = useState<GraphEdge[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const hasFetched = useRef(false)

  const [filters] = useState<GraphFilters>({
    entityTypes: ['person', 'organization', 'location', 'aircraft', 'financial_entity'],
    minConnectionStrength: 0,
    searchHighlight: '',
    layout: 'force-directed',
    showCriminalIndicators: false,
    dateRange: null,
  })

  useEffect(() => {
    if (hasFetched.current) return
    hasFetched.current = true

    fetch(`/api/entity/${entityId}/connections?depth=2&limit=50`)
      .then((res) => res.json())
      .then((json) => {
        const data = json.data || json
        if (data.nodes) {
          setNodes(data.nodes.map((n: any) => ({
            id: n.id,
            name: n.name,
            entityType: n.type || n.entityType,
            mentionCount: n.mention_count || n.mentionCount || 0,
            connectionCount: 0,
            documentCount: 0,
          })))
        }
        if (data.edges) {
          setEdges(data.edges.map((e: any, i: number) => ({
            id: e.id || `edge-${i}`,
            sourceId: e.source || e.sourceId,
            targetId: e.target || e.targetId,
            sourceName: '',
            targetName: '',
            relationshipType: e.relationship_type || e.relationshipType || 'associated_with',
            strength: e.strength || 1,
            evidenceCount: 0,
          })))
        }
      })
      .catch((err) => console.error('[EntityConnections] Fetch error:', err))
      .finally(() => setIsLoading(false))
  }, [entityId])

  if (isLoading) {
    return <LoadingState variant="inline" />
  }

  if (nodes.length === 0) {
    return (
      <EmptyState
        variant="not-processed"
        title="No Connections Yet"
        description="Entity connections will appear as documents are processed and relationships are extracted."
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="h-64 overflow-hidden rounded-lg border border-border">
        <RelationshipGraph
          nodes={nodes}
          edges={edges}
          filters={filters}
          onNodeClick={() => {}}
          onEdgeClick={() => {}}
          onNodeHover={() => {}}
          onEdgeHover={() => {}}
          onNodeDoubleClick={() => {}}
        />
      </div>
      <Link href={`/graph?entity=${entityId}`}>
        <Button variant="outline" size="sm" className="w-full">
          View in Full Graph
        </Button>
      </Link>
    </div>
  )
}

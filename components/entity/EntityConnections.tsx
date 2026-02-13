// components/entity/EntityConnections.tsx
'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
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
  // Will fetch from API: GET /api/entity/{entityId}/connections?depth=2
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []

  const [filters] = useState<GraphFilters>({
    entityTypes: ['person', 'organization', 'location', 'aircraft', 'financial_entity'],
    minConnectionStrength: 0,
    searchHighlight: '',
    layout: 'force-directed',
    showCriminalIndicators: false,
    dateRange: null,
  })

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

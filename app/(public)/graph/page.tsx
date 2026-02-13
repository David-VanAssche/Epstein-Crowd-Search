// app/(public)/graph/page.tsx
'use client'

import dynamic from 'next/dynamic'
import { Suspense, useState, useCallback, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { LoadingState } from '@/components/shared/LoadingState'
import { EmptyState } from '@/components/shared/EmptyState'
import { GraphControls } from '@/components/graph/GraphControls'
import { GraphTooltip } from '@/components/graph/GraphTooltip'
import { PathFinder } from '@/components/graph/PathFinder'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import Link from 'next/link'
import type { GraphNode, GraphEdge, GraphFilters } from '@/types/graph'

const RelationshipGraph = dynamic(
  () => import('@/components/graph/RelationshipGraph').then(mod => ({ default: mod.RelationshipGraph })),
  {
    ssr: false,
    loading: () => <LoadingState variant="page" />,
  }
)

export default function GraphPage() {
  const searchParams = useSearchParams()
  const entityParam = searchParams.get('entity')
  const [nodes, setNodes] = useState<GraphNode[]>([])
  const [edges, setEdges] = useState<GraphEdge[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const hasFetched = useRef(false)
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [selectedEdge, setSelectedEdge] = useState<GraphEdge | null>(null)
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null)
  const [hoveredEdge, setHoveredEdge] = useState<GraphEdge | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })
  const [showPathFinder, setShowPathFinder] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const [filters, setFilters] = useState<GraphFilters>({
    entityTypes: ['person', 'organization', 'location', 'aircraft', 'financial_entity'],
    minConnectionStrength: 0,
    searchHighlight: '',
    layout: 'force-directed',
    showCriminalIndicators: false,
    dateRange: null,
  })

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node)
    setSelectedEdge(null)
  }, [])

  const handleEdgeClick = useCallback((edge: GraphEdge) => {
    setSelectedEdge(edge)
    setSelectedNode(null)
  }, [])

  const handleNodeHover = useCallback((node: GraphNode | null, position: { x: number; y: number }) => {
    setHoveredNode(node)
    setHoveredEdge(null)
    setTooltipPosition(position)
  }, [])

  const handleEdgeHover = useCallback((edge: GraphEdge | null, position: { x: number; y: number }) => {
    setHoveredEdge(edge)
    setHoveredNode(null)
    setTooltipPosition(position)
  }, [])

  const handleNodeDoubleClick = useCallback((node: GraphNode) => {
    window.location.href = `/entity/${node.id}`
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }, [])

  // Fetch graph data from API on mount
  useEffect(() => {
    if (hasFetched.current) return
    hasFetched.current = true

    const params = new URLSearchParams()
    if (entityParam) {
      params.set('entity', entityParam)
      params.set('depth', '2')
      params.set('limit', '200')
    } else {
      params.set('limit', '150')
    }

    fetch(`/api/graph/entities?${params}`)
      .then((res) => res.json())
      .then((json) => {
        const data = json.data || json
        if (data.nodes) setNodes(data.nodes)
        if (data.edges) setEdges(data.edges)
      })
      .catch((err) => console.error('[Graph] Failed to load data:', err))
      .finally(() => setIsLoading(false))
  }, [entityParam])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  if (isLoading) {
    return <LoadingState variant="page" />
  }

  if (nodes.length === 0) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
        <EmptyState
          variant="not-processed"
          title="Entity Relationship Graph"
          description="The entity relationship graph will populate as documents are processed. Entities and their connections are extracted automatically during document analysis."
          showFundingCTA
        />
      </div>
    )
  }

  return (
    <div className="relative h-[calc(100vh-4rem)] w-full overflow-hidden bg-background">
      <Suspense fallback={<LoadingState variant="page" />}>
        <RelationshipGraph
          nodes={nodes}
          edges={edges}
          filters={filters}
          onNodeClick={handleNodeClick}
          onEdgeClick={handleEdgeClick}
          onNodeHover={handleNodeHover}
          onEdgeHover={handleEdgeHover}
          onNodeDoubleClick={handleNodeDoubleClick}
        />
      </Suspense>

      <div className="absolute right-4 top-4 z-10">
        <GraphControls
          filters={filters}
          onFiltersChange={setFilters}
          onToggleFullscreen={toggleFullscreen}
          isFullscreen={isFullscreen}
          onTogglePathFinder={() => setShowPathFinder(!showPathFinder)}
          nodeCount={nodes.length}
          edgeCount={edges.length}
        />
      </div>

      {showPathFinder && (
        <div className="absolute left-4 top-4 z-10 w-80">
          <PathFinder onClose={() => setShowPathFinder(false)} />
        </div>
      )}

      {(hoveredNode || hoveredEdge) && (
        <GraphTooltip
          node={hoveredNode}
          edge={hoveredEdge}
          position={tooltipPosition}
        />
      )}

      <Sheet open={!!selectedNode} onOpenChange={() => setSelectedNode(null)}>
        <SheetContent side="right" className="w-96 overflow-y-auto">
          {selectedNode && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedNode.name}</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                <Badge variant="outline">{selectedNode.entityType}</Badge>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Mentions</span>
                    <span>{selectedNode.mentionCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Connections</span>
                    <span>{selectedNode.connectionCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Documents</span>
                    <span>{selectedNode.documentCount}</span>
                  </div>
                  {selectedNode.firstSeenDate && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">First seen</span>
                      <span>{selectedNode.firstSeenDate}</span>
                    </div>
                  )}
                  {selectedNode.lastSeenDate && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Last seen</span>
                      <span>{selectedNode.lastSeenDate}</span>
                    </div>
                  )}
                </div>
                {selectedNode.aliases && selectedNode.aliases.length > 0 && (
                  <div>
                    <h4 className="mb-2 text-sm font-semibold text-muted-foreground">Aliases</h4>
                    <div className="flex flex-wrap gap-1">
                      {selectedNode.aliases.map((alias) => (
                        <Badge key={alias} variant="secondary" className="text-xs">
                          {alias}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                <div className="pt-4">
                  <Button className="w-full" asChild>
                    <Link href={`/entity/${selectedNode.id}`}>View Full Entity Profile</Link>
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={!!selectedEdge} onOpenChange={() => setSelectedEdge(null)}>
        <SheetContent side="right" className="w-96 overflow-y-auto">
          {selectedEdge && (
            <>
              <SheetHeader>
                <SheetTitle>Connection Evidence</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="outline">{selectedEdge.sourceName}</Badge>
                  <span className="text-muted-foreground">--</span>
                  <Badge variant="secondary">{selectedEdge.relationshipType}</Badge>
                  <span className="text-muted-foreground">--</span>
                  <Badge variant="outline">{selectedEdge.targetName}</Badge>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Strength</span>
                    <span>{selectedEdge.strength}/10</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Evidence documents</span>
                    <span>{selectedEdge.evidenceCount}</span>
                  </div>
                </div>
                {selectedEdge.description && (
                  <p className="text-sm text-muted-foreground">{selectedEdge.description}</p>
                )}
                {selectedEdge.evidenceDocuments && selectedEdge.evidenceDocuments.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-muted-foreground">Source Documents</h4>
                    {selectedEdge.evidenceDocuments.map((doc) => (
                      <Link
                        key={doc.id}
                        href={`/document/${doc.id}`}
                        className="block rounded-lg border border-border bg-surface p-3 transition-colors hover:bg-surface-elevated"
                      >
                        <p className="text-sm font-medium">{doc.filename}</p>
                        {doc.pageNumber && (
                          <p className="text-xs text-muted-foreground">Page {doc.pageNumber}</p>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

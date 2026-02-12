# Phase 8: Advanced Visualization

> **Sessions:** 2 | **Dependencies:** Phase 4 (API), Phase 5 (redaction/entity components) | **Parallel with:** Nothing specific

## Summary

Build the D3 force-directed entity relationship graph (with connection path finder, temporal animation, community detection), interactive timeline view, cascade replay animation, geographic map view, evidence pinboard, document comparison visualization, and researcher placeholder pages. These are the visually impressive features that demonstrate the platform's analytical capabilities and help researchers and prosecutors see the big picture.

## IMPORTANT: Heavy Libraries Must Be Dynamically Imported

Phase 8 introduces several large visualization libraries. All must be dynamically imported to keep the main bundle lean:

```typescript
// D3.js (~250KB) — always dynamic import
const ForceGraph = dynamic(() => import('@/components/graph/RelationshipGraph'), {
  ssr: false,
  loading: () => <LoadingState variant="page" />,
})

// Leaflet (~200KB) — always dynamic import
const Map = dynamic(() => import('@/components/map/EvidenceMap'), {
  ssr: false,
  loading: () => <LoadingState variant="page" />,
})

// Framer Motion — import only needed components
import { motion, AnimatePresence } from 'framer-motion'
```

For graph rendering: use SVG for fewer than 500 nodes, Canvas for 500+ nodes. Timeline should use IntersectionObserver for lazy loading with 1000+ events. Cascade animations should be limited to 200 nodes for smooth playback.

---

## Step-by-Step Execution

### Step 1: Install visualization dependencies

```bash
# D3.js for force-directed graph
pnpm add d3 @types/d3

# Framer Motion for cascade animations
pnpm add framer-motion

# Leaflet for geographic map (lighter alternative to Mapbox, no API key required)
pnpm add leaflet react-leaflet @types/leaflet

# DnD Kit for pinboard drag-and-drop
pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

### Step 2: Create component directories

```bash
mkdir -p components/graph
mkdir -p components/timeline
mkdir -p components/map
mkdir -p components/pinboard
mkdir -p components/gamification
```

### Step 3: Install additional shadcn/ui components (if not already present)

```bash
npx shadcn@latest add slider
npx shadcn@latest add toggle
npx shadcn@latest add toggle-group
npx shadcn@latest add popover
npx shadcn@latest add command
npx shadcn@latest add dialog
npx shadcn@latest add sheet
npx shadcn@latest add switch
```

Answer "yes" to all prompts. All components go into `components/ui/`.

### Step 4: Build the Entity Relationship Graph page and components

#### Graph Page — `app/(public)/graph/page.tsx`

Full-screen graph visualization page. Uses dynamic import to avoid bundling D3 on initial load.

```tsx
// app/(public)/graph/page.tsx
'use client'

import dynamic from 'next/dynamic'
import { Suspense, useState, useCallback } from 'react'
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
  // Graph data — will be fetched from API in production
  const [nodes] = useState<GraphNode[]>([])
  const [edges] = useState<GraphEdge[]>([])

  // UI state
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [selectedEdge, setSelectedEdge] = useState<GraphEdge | null>(null)
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null)
  const [hoveredEdge, setHoveredEdge] = useState<GraphEdge | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })
  const [showPathFinder, setShowPathFinder] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Filter state
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
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }, [])

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
      {/* Graph Canvas */}
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

      {/* Controls Overlay (top-right) */}
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

      {/* Path Finder Overlay */}
      {showPathFinder && (
        <div className="absolute left-4 top-4 z-10 w-80">
          <PathFinder onClose={() => setShowPathFinder(false)} />
        </div>
      )}

      {/* Tooltip */}
      {(hoveredNode || hoveredEdge) && (
        <GraphTooltip
          node={hoveredNode}
          edge={hoveredEdge}
          position={tooltipPosition}
        />
      )}

      {/* Node Detail Sidebar (right) */}
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
                  <Link href={`/entity/${selectedNode.id}`}>
                    <Button className="w-full">View Full Entity Profile</Button>
                  </Link>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Edge Detail Sidebar */}
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
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-muted-foreground">Source Documents</h4>
                  {selectedEdge.evidenceDocuments?.map((doc) => (
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
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
```

#### Graph Loading State — `app/(public)/graph/loading.tsx`

```tsx
// app/(public)/graph/loading.tsx
import { LoadingState } from '@/components/shared/LoadingState'
export default function GraphLoading() {
  return <LoadingState variant="page" />
}
```

#### Relationship Graph Component — `components/graph/RelationshipGraph.tsx`

The core D3 force-directed graph. SVG-based for <500 nodes, Canvas for larger graphs.

```tsx
// components/graph/RelationshipGraph.tsx
'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import * as d3 from 'd3'
import type { GraphNode, GraphEdge, GraphFilters } from '@/types/graph'

const ENTITY_COLORS: Record<string, string> = {
  person: '#60a5fa',        // blue-400
  organization: '#c084fc',  // purple-400
  location: '#4ade80',      // green-400
  aircraft: '#fbbf24',      // amber-400
  financial_entity: '#f87171', // red-400
  event: '#fb923c',         // orange-400
  document: '#94a3b8',      // slate-400
}

const CRIMINAL_COLORS = {
  low: '#4ade80',     // green
  medium: '#fbbf24',  // yellow
  high: '#f87171',    // red
}

interface RelationshipGraphProps {
  nodes: GraphNode[]
  edges: GraphEdge[]
  filters: GraphFilters
  onNodeClick: (node: GraphNode) => void
  onEdgeClick: (edge: GraphEdge) => void
  onNodeHover: (node: GraphNode | null, position: { x: number; y: number }) => void
  onEdgeHover: (edge: GraphEdge | null, position: { x: number; y: number }) => void
  onNodeDoubleClick: (node: GraphNode) => void
}

interface SimulationNode extends d3.SimulationNodeDatum {
  id: string
  name: string
  entityType: string
  mentionCount: number
  connectionCount: number
  criminalIndicatorScore?: number
}

interface SimulationLink extends d3.SimulationLinkDatum<SimulationNode> {
  id: string
  relationshipType: string
  strength: number
}

export function RelationshipGraph({
  nodes,
  edges,
  filters,
  onNodeClick,
  onEdgeClick,
  onNodeHover,
  onEdgeHover,
  onNodeDoubleClick,
}: RelationshipGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const simulationRef = useRef<d3.Simulation<SimulationNode, SimulationLink> | null>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  // Track container size
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        })
      }
    })

    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  // Filter nodes and edges based on current filters
  const filteredNodes = nodes.filter((node) => {
    if (!filters.entityTypes.includes(node.entityType)) return false
    return true
  })

  const filteredNodeIds = new Set(filteredNodes.map((n) => n.id))

  const filteredEdges = edges.filter((edge) => {
    if (!filteredNodeIds.has(edge.sourceId) || !filteredNodeIds.has(edge.targetId)) return false
    if (edge.strength < filters.minConnectionStrength) return false
    return true
  })

  // Compute node radius from mention count (log scale)
  const nodeRadius = useCallback((mentionCount: number) => {
    return Math.max(4, Math.min(30, 4 + Math.log2(mentionCount + 1) * 3))
  }, [])

  // Get node color based on filters
  const nodeColor = useCallback((node: SimulationNode) => {
    if (filters.showCriminalIndicators && node.criminalIndicatorScore !== undefined) {
      if (node.criminalIndicatorScore >= 7) return CRIMINAL_COLORS.high
      if (node.criminalIndicatorScore >= 4) return CRIMINAL_COLORS.medium
      return CRIMINAL_COLORS.low
    }
    return ENTITY_COLORS[node.entityType] || '#94a3b8'
  }, [filters.showCriminalIndicators])

  // Build and run D3 simulation
  useEffect(() => {
    const svg = svgRef.current
    if (!svg || dimensions.width === 0 || dimensions.height === 0) return

    if (simulationRef.current) {
      simulationRef.current.stop()
    }

    const svgSelection = d3.select(svg)
    svgSelection.selectAll('*').remove()

    // Prepare simulation data
    const simNodes: SimulationNode[] = filteredNodes.map((n) => ({
      id: n.id,
      name: n.name,
      entityType: n.entityType,
      mentionCount: n.mentionCount,
      connectionCount: n.connectionCount,
      criminalIndicatorScore: n.criminalIndicatorScore,
    }))

    const nodeMap = new Map(simNodes.map((n) => [n.id, n]))

    const simLinks: SimulationLink[] = filteredEdges
      .filter((e) => nodeMap.has(e.sourceId) && nodeMap.has(e.targetId))
      .map((e) => ({
        id: e.id,
        source: e.sourceId,
        target: e.targetId,
        relationshipType: e.relationshipType,
        strength: e.strength,
      }))

    // Create zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 10])
      .on('zoom', (event) => {
        container.attr('transform', event.transform)
      })

    svgSelection.call(zoom)

    const container = svgSelection.append('g')

    // Edge lines
    const linkGroup = container.append('g').attr('class', 'links')
    const links = linkGroup
      .selectAll('line')
      .data(simLinks)
      .join('line')
      .attr('stroke', '#475569')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', (d) => Math.max(1, d.strength / 3))
      .style('cursor', 'pointer')
      .on('click', (_event, d) => {
        const originalEdge = edges.find((e) => e.id === d.id)
        if (originalEdge) onEdgeClick(originalEdge)
      })
      .on('mouseenter', (event, d) => {
        const originalEdge = edges.find((e) => e.id === d.id)
        if (originalEdge) onEdgeHover(originalEdge, { x: event.clientX, y: event.clientY })
      })
      .on('mouseleave', () => {
        onEdgeHover(null, { x: 0, y: 0 })
      })

    // Node groups
    const nodeGroup = container.append('g').attr('class', 'nodes')
    const nodeElements = nodeGroup
      .selectAll<SVGGElement, SimulationNode>('g')
      .data(simNodes)
      .join('g')
      .style('cursor', 'pointer')
      .call(
        d3.drag<SVGGElement, SimulationNode>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart()
            d.fx = d.x
            d.fy = d.y
          })
          .on('drag', (event, d) => {
            d.fx = event.x
            d.fy = event.y
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0)
            d.fx = null
            d.fy = null
          })
      )

    // Node circles
    nodeElements
      .append('circle')
      .attr('r', (d) => nodeRadius(d.mentionCount))
      .attr('fill', (d) => nodeColor(d))
      .attr('stroke', (d) => {
        if (filters.searchHighlight && d.name.toLowerCase().includes(filters.searchHighlight.toLowerCase())) {
          return '#fbbf24'
        }
        return 'rgba(255,255,255,0.2)'
      })
      .attr('stroke-width', (d) => {
        if (filters.searchHighlight && d.name.toLowerCase().includes(filters.searchHighlight.toLowerCase())) {
          return 3
        }
        return 1.5
      })

    // Node labels
    nodeElements
      .append('text')
      .text((d) => d.name.length > 15 ? d.name.slice(0, 13) + '...' : d.name)
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => nodeRadius(d.mentionCount) + 14)
      .attr('fill', '#cbd5e1')
      .attr('font-size', '10px')
      .attr('pointer-events', 'none')

    // Node interactions
    nodeElements
      .on('click', (_event, d) => {
        const originalNode = nodes.find((n) => n.id === d.id)
        if (originalNode) onNodeClick(originalNode)
      })
      .on('dblclick', (_event, d) => {
        const originalNode = nodes.find((n) => n.id === d.id)
        if (originalNode) onNodeDoubleClick(originalNode)
      })
      .on('mouseenter', (event, d) => {
        const originalNode = nodes.find((n) => n.id === d.id)
        if (originalNode) onNodeHover(originalNode, { x: event.clientX, y: event.clientY })
      })
      .on('mouseleave', () => {
        onNodeHover(null, { x: 0, y: 0 })
      })

    // Force simulation
    const simulation = d3.forceSimulation(simNodes)
      .force('link', d3.forceLink<SimulationNode, SimulationLink>(simLinks)
        .id((d) => d.id)
        .distance(100)
        .strength((d) => d.strength / 10)
      )
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(dimensions.width / 2, dimensions.height / 2))
      .force('collide', d3.forceCollide<SimulationNode>()
        .radius((d) => nodeRadius(d.mentionCount) + 5)
      )
      .on('tick', () => {
        links
          .attr('x1', (d) => (d.source as SimulationNode).x ?? 0)
          .attr('y1', (d) => (d.source as SimulationNode).y ?? 0)
          .attr('x2', (d) => (d.target as SimulationNode).x ?? 0)
          .attr('y2', (d) => (d.target as SimulationNode).y ?? 0)

        nodeElements.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`)
      })

    simulationRef.current = simulation

    return () => {
      simulation.stop()
    }
  }, [filteredNodes, filteredEdges, dimensions, filters, nodeRadius, nodeColor, nodes, edges, onNodeClick, onEdgeClick, onNodeHover, onEdgeHover, onNodeDoubleClick])

  return (
    <div ref={containerRef} className="h-full w-full">
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="bg-background"
      />
    </div>
  )
}
```

#### Graph Controls Component — `components/graph/GraphControls.tsx`

Control panel for the graph: filters, layout, search, and advanced features.

```tsx
// components/graph/GraphControls.tsx
'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import type { GraphFilters } from '@/types/graph'

const ENTITY_TYPES = [
  { value: 'person', label: 'People', color: '#60a5fa' },
  { value: 'organization', label: 'Organizations', color: '#c084fc' },
  { value: 'location', label: 'Locations', color: '#4ade80' },
  { value: 'aircraft', label: 'Aircraft', color: '#fbbf24' },
  { value: 'financial_entity', label: 'Financial', color: '#f87171' },
]

const LAYOUT_OPTIONS = [
  { value: 'force-directed', label: 'Force-Directed' },
  { value: 'radial', label: 'Radial' },
  { value: 'hierarchical', label: 'Hierarchical' },
]

interface GraphControlsProps {
  filters: GraphFilters
  onFiltersChange: (filters: GraphFilters) => void
  onToggleFullscreen: () => void
  isFullscreen: boolean
  onTogglePathFinder: () => void
  nodeCount: number
  edgeCount: number
}

export function GraphControls({
  filters,
  onFiltersChange,
  onToggleFullscreen,
  isFullscreen,
  onTogglePathFinder,
  nodeCount,
  edgeCount,
}: GraphControlsProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  const toggleEntityType = (type: string) => {
    const current = filters.entityTypes
    const updated = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type]
    onFiltersChange({ ...filters, entityTypes: updated })
  }

  return (
    <Card className="w-72 border-border bg-surface/95 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm">Controls</CardTitle>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={onTogglePathFinder} title="Find Path">
            Path
          </Button>
          <Button variant="ghost" size="sm" onClick={onToggleFullscreen} title="Toggle fullscreen">
            {isFullscreen ? 'Exit' : 'Full'}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setIsExpanded(!isExpanded)}>
            {isExpanded ? 'Hide' : 'Show'}
          </Button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>{nodeCount} entities</span>
            <span>{edgeCount} connections</span>
          </div>

          <Separator />

          {/* Search to Highlight */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Search & Highlight</Label>
            <Input
              placeholder="Search entities..."
              value={filters.searchHighlight}
              onChange={(e) => onFiltersChange({ ...filters, searchHighlight: e.target.value })}
              className="h-8 text-sm"
            />
          </div>

          <Separator />

          {/* Entity Type Filters */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Entity Types</Label>
            {ENTITY_TYPES.map(({ value, label, color }) => (
              <div key={value} className="flex items-center gap-2">
                <Checkbox
                  id={`type-${value}`}
                  checked={filters.entityTypes.includes(value)}
                  onCheckedChange={() => toggleEntityType(value)}
                />
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
                <Label htmlFor={`type-${value}`} className="text-xs">
                  {label}
                </Label>
              </div>
            ))}
          </div>

          <Separator />

          {/* Connection Strength */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Min Connection Strength: {filters.minConnectionStrength}
            </Label>
            <Slider
              value={[filters.minConnectionStrength]}
              onValueChange={([val]) => onFiltersChange({ ...filters, minConnectionStrength: val })}
              min={0}
              max={10}
              step={1}
            />
          </div>

          <Separator />

          {/* Layout Algorithm */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Layout</Label>
            <Select
              value={filters.layout}
              onValueChange={(val) => onFiltersChange({ ...filters, layout: val as GraphFilters['layout'] })}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LAYOUT_OPTIONS.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Criminal Indicator Overlay */}
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Criminal indicators</Label>
            <Switch
              checked={filters.showCriminalIndicators}
              onCheckedChange={(checked) =>
                onFiltersChange({ ...filters, showCriminalIndicators: checked })
              }
            />
          </div>

          {filters.showCriminalIndicators && (
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-green-400" />
                <span>Low</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-amber-400" />
                <span>Medium</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-red-400" />
                <span>High</span>
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
```

#### Graph Tooltip Component — `components/graph/GraphTooltip.tsx`

Hover card positioned near the cursor for nodes and edges.

```tsx
// components/graph/GraphTooltip.tsx
'use client'

import { Badge } from '@/components/ui/badge'
import type { GraphNode, GraphEdge } from '@/types/graph'

interface GraphTooltipProps {
  node: GraphNode | null
  edge: GraphEdge | null
  position: { x: number; y: number }
}

export function GraphTooltip({ node, edge, position }: GraphTooltipProps) {
  if (!node && !edge) return null

  const style: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(position.x + 12, window.innerWidth - 280),
    top: Math.min(position.y + 12, window.innerHeight - 200),
    zIndex: 50,
    pointerEvents: 'none',
  }

  if (node) {
    return (
      <div style={style} className="w-64 rounded-lg border border-border bg-surface p-3 shadow-xl">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-sm font-semibold">{node.name}</span>
          <Badge variant="outline" className="text-xs">{node.entityType}</Badge>
        </div>
        <div className="space-y-1 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>Mentions</span>
            <span>{node.mentionCount}</span>
          </div>
          <div className="flex justify-between">
            <span>Connections</span>
            <span>{node.connectionCount}</span>
          </div>
          <div className="flex justify-between">
            <span>Documents</span>
            <span>{node.documentCount}</span>
          </div>
        </div>
        {node.topConnections && node.topConnections.length > 0 && (
          <div className="mt-2 border-t border-border pt-2">
            <span className="text-xs text-muted-foreground">Top connections:</span>
            <div className="mt-1 flex flex-wrap gap-1">
              {node.topConnections.slice(0, 5).map((name) => (
                <Badge key={name} variant="secondary" className="text-xs">
                  {name}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  if (edge) {
    return (
      <div style={style} className="w-64 rounded-lg border border-border bg-surface p-3 shadow-xl">
        <div className="mb-2 flex items-center gap-1 text-xs">
          <span className="font-medium">{edge.sourceName}</span>
          <span className="text-muted-foreground">--</span>
          <Badge variant="secondary" className="text-xs">{edge.relationshipType}</Badge>
          <span className="text-muted-foreground">--</span>
          <span className="font-medium">{edge.targetName}</span>
        </div>
        <div className="space-y-1 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>Strength</span>
            <span>{edge.strength}/10</span>
          </div>
          <div className="flex justify-between">
            <span>Evidence documents</span>
            <span>{edge.evidenceCount}</span>
          </div>
        </div>
        {edge.description && (
          <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{edge.description}</p>
        )}
      </div>
    )
  }

  return null
}
```

#### Path Finder Component — `components/graph/PathFinder.tsx`

Select two entities and find the shortest connection path between them.

```tsx
// components/graph/PathFinder.tsx
'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import Link from 'next/link'

interface PathStep {
  entityId: string
  entityName: string
  entityType: string
  relationshipType: string
  evidenceDocuments: Array<{ id: string; filename: string; pageNumber?: number }>
}

interface PathFinderProps {
  onClose: () => void
}

export function PathFinder({ onClose }: PathFinderProps) {
  const [sourceSearch, setSourceSearch] = useState('')
  const [targetSearch, setTargetSearch] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [path, setPath] = useState<PathStep[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFindPath = async () => {
    if (!sourceSearch.trim() || !targetSearch.trim()) return

    setIsSearching(true)
    setError(null)
    setPath(null)

    try {
      // Will call API: GET /api/graph/path?source=X&target=Y
      const res = await fetch(
        `/api/graph/path?source=${encodeURIComponent(sourceSearch)}&target=${encodeURIComponent(targetSearch)}`
      )
      if (!res.ok) throw new Error('No path found')
      const data = await res.json()
      setPath(data.path)
    } catch {
      setError('No connection path found between these entities, or the API is not yet available.')
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <Card className="border-border bg-surface/95 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm">Find Connection Path</CardTitle>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">From entity</Label>
          <Input
            placeholder="e.g., Jeffrey Epstein"
            value={sourceSearch}
            onChange={(e) => setSourceSearch(e.target.value)}
            className="h-8 text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">To entity</Label>
          <Input
            placeholder="e.g., Bill Clinton"
            value={targetSearch}
            onChange={(e) => setTargetSearch(e.target.value)}
            className="h-8 text-sm"
          />
        </div>

        <Button
          onClick={handleFindPath}
          disabled={!sourceSearch.trim() || !targetSearch.trim() || isSearching}
          className="w-full"
          size="sm"
        >
          {isSearching ? 'Searching...' : 'Find Connection'}
        </Button>

        {error && (
          <p className="text-xs text-red-400">{error}</p>
        )}

        {path && path.length > 0 && (
          <>
            <Separator />
            <div className="text-center text-sm font-medium text-accent">
              {path.length - 1} degree{path.length - 1 !== 1 ? 's' : ''} of separation
            </div>
            <div className="space-y-3">
              {path.map((step, i) => (
                <div key={step.entityId}>
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/20 text-xs font-bold text-accent">
                      {i + 1}
                    </div>
                    <Link
                      href={`/entity/${step.entityId}`}
                      className="text-sm font-medium hover:text-accent"
                    >
                      {step.entityName}
                    </Link>
                    <Badge variant="outline" className="text-xs">{step.entityType}</Badge>
                  </div>
                  {i < path.length - 1 && (
                    <div className="ml-3 border-l border-border py-2 pl-4">
                      <Badge variant="secondary" className="text-xs">{step.relationshipType}</Badge>
                      {step.evidenceDocuments.length > 0 && (
                        <div className="mt-1 space-y-1">
                          {step.evidenceDocuments.slice(0, 2).map((doc) => (
                            <Link
                              key={doc.id}
                              href={`/document/${doc.id}`}
                              className="block text-xs text-blue-400 hover:underline"
                            >
                              {doc.filename}{doc.pageNumber ? ` (p. ${doc.pageNumber})` : ''}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <Button variant="outline" size="sm" className="w-full">
              Export as Evidence Chain
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
```

#### Temporal Graph Component — `components/graph/TemporalGraph.tsx`

Time-evolving network visualization with animation controls and key event markers.

```tsx
// components/graph/TemporalGraph.tsx
'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface KeyEvent {
  date: string
  label: string
  type: 'arrest' | 'raid' | 'legal' | 'death' | 'other'
}

const KEY_EVENTS: KeyEvent[] = [
  { date: '2005-03-01', label: 'Palm Beach PD investigation begins', type: 'legal' },
  { date: '2006-05-01', label: 'FBI investigation launched', type: 'legal' },
  { date: '2008-06-30', label: 'Plea deal signed', type: 'legal' },
  { date: '2019-07-06', label: 'Arrested at Teterboro Airport', type: 'arrest' },
  { date: '2019-07-08', label: 'Federal indictment (SDNY)', type: 'legal' },
  { date: '2019-08-10', label: 'Death in MCC Manhattan', type: 'death' },
  { date: '2020-07-02', label: 'Ghislaine Maxwell arrested', type: 'arrest' },
  { date: '2021-12-29', label: 'Maxwell convicted', type: 'legal' },
]

interface TemporalGraphProps {
  minDate: string
  maxDate: string
  onDateChange: (date: string) => void
}

export function TemporalGraph({ minDate, maxDate, onDateChange }: TemporalGraphProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState<'1x' | '2x' | '5x'>('1x')
  const [currentDateIndex, setCurrentDateIndex] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Generate date range (monthly intervals)
  const dateRange: string[] = []
  const start = new Date(minDate)
  const end = new Date(maxDate)
  const cursor = new Date(start)
  while (cursor <= end) {
    dateRange.push(cursor.toISOString().slice(0, 10))
    cursor.setMonth(cursor.getMonth() + 1)
  }

  const currentDate = dateRange[currentDateIndex] || minDate

  const speedMs = { '1x': 500, '2x': 250, '5x': 100 }

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrentDateIndex((prev) => {
          if (prev >= dateRange.length - 1) {
            setIsPlaying(false)
            return prev
          }
          return prev + 1
        })
      }, speedMs[speed])
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isPlaying, speed, dateRange.length])

  useEffect(() => {
    onDateChange(currentDate)
  }, [currentDate, onDateChange])

  const handleReset = useCallback(() => {
    setIsPlaying(false)
    setCurrentDateIndex(0)
  }, [])

  return (
    <div className="absolute bottom-4 left-4 right-4 z-10 rounded-lg border border-border bg-surface/95 p-4 backdrop-blur-sm">
      {/* Key event markers */}
      <div className="relative mb-2 h-6">
        {KEY_EVENTS.map((event) => {
          const eventDate = new Date(event.date)
          const startDate = new Date(minDate)
          const endDate = new Date(maxDate)
          const position = ((eventDate.getTime() - startDate.getTime()) / (endDate.getTime() - startDate.getTime())) * 100
          if (position < 0 || position > 100) return null
          return (
            <div
              key={event.date}
              className="absolute -translate-x-1/2 cursor-help"
              style={{ left: `${position}%` }}
              title={`${event.date}: ${event.label}`}
            >
              <div className={`h-4 w-1 rounded-full ${
                event.type === 'arrest' ? 'bg-red-400' :
                event.type === 'death' ? 'bg-gray-400' :
                event.type === 'legal' ? 'bg-amber-400' :
                'bg-blue-400'
              }`} />
            </div>
          )
        })}
      </div>

      <Slider
        value={[currentDateIndex]}
        onValueChange={([val]) => {
          setCurrentDateIndex(val)
          setIsPlaying(false)
        }}
        min={0}
        max={dateRange.length - 1}
        step={1}
      />

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsPlaying(!isPlaying)}>
            {isPlaying ? 'Pause' : 'Play'}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleReset}>Reset</Button>
          <Select value={speed} onValueChange={(val) => setSpeed(val as typeof speed)}>
            <SelectTrigger className="h-8 w-20 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1x">1x</SelectItem>
              <SelectItem value="2x">2x</SelectItem>
              <SelectItem value="5x">5x</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="text-sm font-medium text-accent">
          {new Date(currentDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}
        </div>
        <div className="flex gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="gap-1">
            <div className="h-2 w-2 rounded-full bg-red-400" /> Arrest
          </Badge>
          <Badge variant="outline" className="gap-1">
            <div className="h-2 w-2 rounded-full bg-amber-400" /> Legal
          </Badge>
        </div>
      </div>
    </div>
  )
}
```

### Step 5: Build the Interactive Timeline page and components

#### Timeline Page — `app/(public)/timeline/page.tsx`

Vertical scrolling timeline with filters and lazy loading.

```tsx
// app/(public)/timeline/page.tsx
'use client'

import { useState, useMemo } from 'react'
import { TimelineView } from '@/components/timeline/TimelineView'
import { TimelineFilters } from '@/components/timeline/TimelineFilters'
import { EmptyState } from '@/components/shared/EmptyState'
import type { TimelineEvent } from '@/types/timeline'

interface TimelineFilterState {
  entityIds: string[]
  dateFrom: string | null
  dateTo: string | null
  eventTypes: string[]
}

export default function TimelinePage() {
  const [filters, setFilters] = useState<TimelineFilterState>({
    entityIds: [],
    dateFrom: null,
    dateTo: null,
    eventTypes: [],
  })

  // Will fetch from API in production
  const events: TimelineEvent[] = []

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (filters.entityIds.length > 0) {
        const eventEntityIds = event.entities.map((e) => e.id)
        if (!filters.entityIds.some((id) => eventEntityIds.includes(id))) return false
      }
      if (filters.dateFrom && event.date < filters.dateFrom) return false
      if (filters.dateTo && event.date > filters.dateTo) return false
      if (filters.eventTypes.length > 0 && !filters.eventTypes.includes(event.eventType)) return false
      return true
    })
  }, [events, filters])

  const activeFilterCount = [
    filters.entityIds.length > 0,
    filters.dateFrom !== null,
    filters.dateTo !== null,
    filters.eventTypes.length > 0,
  ].filter(Boolean).length

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 lg:px-8">
      <h1 className="mb-2 text-3xl font-bold">Timeline</h1>
      <p className="mb-6 text-muted-foreground">
        A chronological view of events extracted from the Epstein files. Filter by person,
        date range, or event type to explore the timeline of activity.
      </p>

      <TimelineFilters
        filters={filters}
        onFiltersChange={setFilters}
        activeFilterCount={activeFilterCount}
      />

      {filteredEvents.length > 0 ? (
        <TimelineView events={filteredEvents} />
      ) : (
        <EmptyState
          variant="not-processed"
          title="Timeline View"
          description="Timeline events will appear here as documents are processed. Events are extracted from dates, meetings, travel records, legal proceedings, and other temporal data in the corpus."
          showFundingCTA
        />
      )}
    </div>
  )
}
```

#### Timeline Loading State — `app/(public)/timeline/loading.tsx`

```tsx
// app/(public)/timeline/loading.tsx
import { LoadingState } from '@/components/shared/LoadingState'
export default function TimelineLoading() {
  return <LoadingState variant="page" />
}
```

#### Timeline View Component — `components/timeline/TimelineView.tsx`

Vertical scrolling timeline with alternating left/right event cards and IntersectionObserver for lazy loading.

```tsx
// components/timeline/TimelineView.tsx
'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { TimelineEventCard } from '@/components/timeline/TimelineEventCard'
import type { TimelineEvent } from '@/types/timeline'

interface TimelineViewProps {
  events: TimelineEvent[]
}

export function TimelineView({ events }: TimelineViewProps) {
  const [visibleCount, setVisibleCount] = useState(50)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Group events by year
  const eventsByYear = events.reduce<Record<string, TimelineEvent[]>>((acc, event) => {
    const year = event.date.slice(0, 4)
    if (!acc[year]) acc[year] = []
    acc[year].push(event)
    return acc
  }, {})

  const sortedYears = Object.keys(eventsByYear).sort()

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < events.length) {
          setVisibleCount((prev) => Math.min(prev + 50, events.length))
        }
      },
      { rootMargin: '200px' }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [visibleCount, events.length])

  const scrollToYear = useCallback((year: string) => {
    const element = document.getElementById(`timeline-year-${year}`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  let eventIndex = 0

  return (
    <div className="relative">
      {/* Year quick-jump nav (sticky) */}
      <div className="sticky top-16 z-10 mb-6 flex flex-wrap gap-2 bg-background/95 py-2 backdrop-blur-sm">
        {sortedYears.map((year) => (
          <button
            key={year}
            onClick={() => scrollToYear(year)}
            className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-primary"
          >
            {year}
          </button>
        ))}
      </div>

      {/* Timeline spine */}
      <div className="relative">
        <div className="absolute left-1/2 top-0 hidden h-full w-px -translate-x-1/2 bg-border md:block" />
        <div className="absolute left-4 top-0 h-full w-px bg-border md:hidden" />

        {sortedYears.map((year) => {
          const yearEvents = eventsByYear[year]
          return (
            <div key={year} id={`timeline-year-${year}`}>
              <div className="relative mb-6 flex items-center justify-center">
                <div className="z-10 rounded-full border border-accent bg-background px-4 py-1 text-sm font-bold text-accent">
                  {year}
                </div>
              </div>
              {yearEvents.map((event) => {
                const idx = eventIndex++
                if (idx >= visibleCount) return null
                const isLeft = idx % 2 === 0
                return (
                  <TimelineEventCard
                    key={event.id}
                    event={event}
                    side={isLeft ? 'left' : 'right'}
                  />
                )
              })}
            </div>
          )
        })}

        {visibleCount < events.length && (
          <div ref={sentinelRef} className="flex justify-center py-8">
            <span className="text-sm text-muted-foreground">Loading more events...</span>
          </div>
        )}
      </div>
    </div>
  )
}
```

#### Timeline Event Card Component — `components/timeline/TimelineEventCard.tsx`

Individual event card on the timeline with date, type badge, entities, and source citations.

```tsx
// components/timeline/TimelineEventCard.tsx
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { TimelineEvent } from '@/types/timeline'

const EVENT_TYPE_COLORS: Record<string, string> = {
  travel: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  meeting: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  legal: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  financial: 'bg-green-500/20 text-green-400 border-green-500/30',
  communication: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  arrest: 'bg-red-500/20 text-red-400 border-red-500/30',
  property: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  other: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
}

const DATE_PRECISION_LABELS: Record<string, string> = {
  exact: '',
  approximate: '(approx.)',
  month: '(month)',
  year: '(year)',
  unknown: '(date unclear)',
}

interface TimelineEventCardProps {
  event: TimelineEvent
  side: 'left' | 'right'
}

export function TimelineEventCard({ event, side }: TimelineEventCardProps) {
  const typeColors = EVENT_TYPE_COLORS[event.eventType] || EVENT_TYPE_COLORS.other

  return (
    <div className={`relative mb-8 flex items-start ${
      side === 'left'
        ? 'md:flex-row-reverse md:pr-[calc(50%+2rem)] md:pl-0 pl-12'
        : 'md:pl-[calc(50%+2rem)] md:pr-0 pl-12'
    }`}>
      {/* Connection dot on the spine */}
      <div className="absolute left-1/2 top-3 hidden h-3 w-3 -translate-x-1/2 rounded-full border-2 border-accent bg-background md:block" />
      <div className="absolute left-[13px] top-3 h-3 w-3 rounded-full border-2 border-accent bg-background md:hidden" />

      {/* Connection line to spine */}
      <div className={`absolute top-[17px] hidden h-px bg-border md:block ${
        side === 'left'
          ? 'right-1/2 left-auto w-8 mr-[6px]'
          : 'left-1/2 right-auto w-8 ml-[6px]'
      }`} />

      <Card className="w-full border-border bg-surface transition-colors hover:bg-surface-elevated">
        <CardContent className="pt-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-sm font-medium text-primary">
              {new Date(event.date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: event.datePrecision === 'exact' ? 'numeric' : undefined,
              })}
            </span>
            {event.datePrecision && event.datePrecision !== 'exact' && (
              <span className="text-xs text-muted-foreground">
                {DATE_PRECISION_LABELS[event.datePrecision]}
              </span>
            )}
          </div>

          <Badge variant="outline" className={`mb-2 ${typeColors}`}>
            {event.eventType}
          </Badge>

          <p className="mb-3 text-sm text-muted-foreground">{event.description}</p>

          {event.location && (
            <p className="mb-2 text-xs text-muted-foreground">
              Location: {event.location}
            </p>
          )}

          {event.entities.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1">
              {event.entities.map((entity) => (
                <Link key={entity.id} href={`/entity/${entity.id}`}>
                  <Badge variant="secondary" className="cursor-pointer text-xs hover:bg-accent/20">
                    {entity.name}
                  </Badge>
                </Link>
              ))}
            </div>
          )}

          {event.sourceDocuments.length > 0 && (
            <div className="border-t border-border pt-2">
              <span className="text-xs text-muted-foreground">Sources: </span>
              {event.sourceDocuments.map((doc, i) => (
                <span key={doc.id}>
                  {i > 0 && ', '}
                  <Link
                    href={`/document/${doc.id}${doc.pageNumber ? `#page-${doc.pageNumber}` : ''}`}
                    className="text-xs text-blue-400 hover:underline"
                  >
                    {doc.filename}{doc.pageNumber ? ` p.${doc.pageNumber}` : ''}
                  </Link>
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

#### Timeline Filters Component — `components/timeline/TimelineFilters.tsx`

Filter controls for the timeline page.

```tsx
// components/timeline/TimelineFilters.tsx
'use client'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const EVENT_TYPES = [
  'travel', 'meeting', 'legal', 'financial',
  'communication', 'arrest', 'property', 'other',
]

interface TimelineFilterState {
  entityIds: string[]
  dateFrom: string | null
  dateTo: string | null
  eventTypes: string[]
}

interface TimelineFiltersProps {
  filters: TimelineFilterState
  onFiltersChange: (filters: TimelineFilterState) => void
  activeFilterCount: number
}

export function TimelineFilters({ filters, onFiltersChange, activeFilterCount }: TimelineFiltersProps) {
  const handleClearAll = () => {
    onFiltersChange({
      entityIds: [],
      dateFrom: null,
      dateTo: null,
      eventTypes: [],
    })
  }

  const toggleEventType = (type: string) => {
    const current = filters.eventTypes
    const updated = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type]
    onFiltersChange({ ...filters, eventTypes: updated })
  }

  return (
    <div className="mb-8 flex flex-wrap items-center gap-3">
      <Input placeholder="Filter by entity..." className="h-9 max-w-xs text-sm" />

      <Input
        type="date"
        value={filters.dateFrom || ''}
        onChange={(e) => onFiltersChange({ ...filters, dateFrom: e.target.value || null })}
        className="h-9 w-40 text-sm"
        placeholder="From"
      />
      <span className="text-muted-foreground">to</span>
      <Input
        type="date"
        value={filters.dateTo || ''}
        onChange={(e) => onFiltersChange({ ...filters, dateTo: e.target.value || null })}
        className="h-9 w-40 text-sm"
        placeholder="To"
      />

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm">
            Event Type
            {filters.eventTypes.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {filters.eventTypes.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48">
          <div className="space-y-2">
            {EVENT_TYPES.map((type) => (
              <div key={type} className="flex items-center gap-2">
                <Checkbox
                  id={`event-${type}`}
                  checked={filters.eventTypes.includes(type)}
                  onCheckedChange={() => toggleEventType(type)}
                />
                <Label htmlFor={`event-${type}`} className="text-sm capitalize">
                  {type}
                </Label>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {activeFilterCount > 0 && (
        <Button variant="ghost" size="sm" onClick={handleClearAll}>
          Clear all ({activeFilterCount})
        </Button>
      )}
    </div>
  )
}
```

### Step 6: Build the Geographic Map page and components

#### Map Page — `app/(public)/map/page.tsx`

Geographic evidence map with location pins, flight routes, and date filtering.

```tsx
// app/(public)/map/page.tsx
'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { LoadingState } from '@/components/shared/LoadingState'
import { EmptyState } from '@/components/shared/EmptyState'
import { MapControls } from '@/components/map/MapControls'
import { MapSidebar } from '@/components/map/MapSidebar'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { MapLocation, MapFilters } from '@/types/map'

const EvidenceMap = dynamic(
  () => import('@/components/map/EvidenceMap').then(mod => ({ default: mod.EvidenceMap })),
  {
    ssr: false,
    loading: () => <LoadingState variant="page" />,
  }
)

export default function MapPage() {
  const [locations] = useState<MapLocation[]>([])
  const [selectedLocation, setSelectedLocation] = useState<MapLocation | null>(null)
  const [filters, setFilters] = useState<MapFilters>({
    locationTypes: ['property', 'city', 'country', 'venue'],
    dateFrom: null,
    dateTo: null,
    entityIds: [],
    showFlightRoutes: true,
    showProperties: true,
    showAllMentions: true,
    viewMode: 'pins', // 'pins' | 'heatmap'
  })

  if (locations.length === 0) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
        <EmptyState
          variant="not-processed"
          title="Geographic Evidence Map"
          description="The evidence map will show location pins, flight routes, and property markers as documents are processed. Known properties include NYC townhouse, Palm Beach estate, New Mexico ranch, Little St. James island, and Paris apartment."
          showFundingCTA
        />
      </div>
    )
  }

  return (
    <div className="relative h-[calc(100vh-4rem)] w-full overflow-hidden">
      {/* Map Canvas */}
      <EvidenceMap
        locations={locations}
        filters={filters}
        onLocationClick={setSelectedLocation}
      />

      {/* Controls Overlay (top-left) */}
      <div className="absolute left-4 top-4 z-10">
        <MapControls filters={filters} onFiltersChange={setFilters} />
      </div>

      {/* Location Detail Sidebar */}
      <Sheet open={!!selectedLocation} onOpenChange={() => setSelectedLocation(null)}>
        <SheetContent side="right" className="w-96 overflow-y-auto">
          {selectedLocation && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedLocation.name}</SheetTitle>
              </SheetHeader>
              <MapSidebar location={selectedLocation} />
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
```

#### Map Loading State — `app/(public)/map/loading.tsx`

```tsx
// app/(public)/map/loading.tsx
import { LoadingState } from '@/components/shared/LoadingState'
export default function MapLoading() {
  return <LoadingState variant="page" />
}
```

#### Evidence Map Component — `components/map/EvidenceMap.tsx`

Interactive Leaflet map with clustering, popups, and flight route lines.

```tsx
// components/map/EvidenceMap.tsx
'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { MapLocation, MapFilters } from '@/types/map'

const LOCATION_TYPE_COLORS: Record<string, string> = {
  property: '#f87171',  // red — known Epstein properties
  city: '#60a5fa',      // blue
  country: '#4ade80',   // green
  venue: '#c084fc',     // purple
}

// Known Epstein properties for highlighting
const KNOWN_PROPERTIES = [
  { name: 'NYC Townhouse', lat: 40.7688, lng: -73.9650 },
  { name: 'Palm Beach Estate', lat: 26.6957, lng: -80.0353 },
  { name: 'Zorro Ranch (NM)', lat: 32.8000, lng: -105.4800 },
  { name: 'Little St. James', lat: 18.3000, lng: -64.8256 },
  { name: 'Paris Apartment', lat: 48.8656, lng: 2.3212 },
]

interface EvidenceMapProps {
  locations: MapLocation[]
  filters: MapFilters
  onLocationClick: (location: MapLocation) => void
}

export function EvidenceMap({ locations, filters, onLocationClick }: EvidenceMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const leafletMapRef = useRef<L.Map | null>(null)

  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) return

    // Initialize map centered on the Atlantic (between US and Europe)
    const map = L.map(mapRef.current, {
      center: [30, -40],
      zoom: 3,
      zoomControl: true,
    })

    // Dark tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      maxZoom: 19,
    }).addTo(map)

    leafletMapRef.current = map

    return () => {
      map.remove()
      leafletMapRef.current = null
    }
  }, [])

  // Update markers when locations or filters change
  useEffect(() => {
    const map = leafletMapRef.current
    if (!map) return

    // Clear existing markers (except tile layer)
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker || layer instanceof L.Polyline || layer instanceof L.CircleMarker) {
        map.removeLayer(layer)
      }
    })

    // Filter locations
    const filtered = locations.filter((loc) => {
      if (!filters.locationTypes.includes(loc.locationType)) return false
      if (filters.dateFrom && loc.lastMentionDate && loc.lastMentionDate < filters.dateFrom) return false
      if (filters.dateTo && loc.firstMentionDate && loc.firstMentionDate > filters.dateTo) return false
      return true
    })

    // Add markers
    filtered.forEach((loc) => {
      const color = LOCATION_TYPE_COLORS[loc.locationType] || '#94a3b8'
      const radius = Math.max(5, Math.min(20, 5 + Math.log2(loc.mentionCount + 1) * 2))

      const marker = L.circleMarker([loc.lat, loc.lng], {
        radius,
        fillColor: color,
        color: 'rgba(255,255,255,0.3)',
        weight: 1,
        fillOpacity: 0.8,
      })

      marker.bindPopup(`
        <div style="color: #e2e8f0; min-width: 150px;">
          <strong>${loc.name}</strong><br/>
          <span style="color: #94a3b8;">Type: ${loc.locationType}</span><br/>
          <span style="color: #94a3b8;">Mentions: ${loc.mentionCount}</span><br/>
          <span style="color: #94a3b8;">Entities: ${loc.topEntities?.slice(0, 3).join(', ') || 'N/A'}</span>
        </div>
      `)

      marker.on('click', () => onLocationClick(loc))
      marker.addTo(map)
    })

    // Add flight routes if enabled
    if (filters.showFlightRoutes) {
      const flightLocations = filtered.filter((loc) => loc.flightConnections && loc.flightConnections.length > 0)
      flightLocations.forEach((origin) => {
        origin.flightConnections?.forEach((dest) => {
          const destLoc = filtered.find((l) => l.id === dest.destinationId)
          if (destLoc) {
            const line = L.polyline(
              [[origin.lat, origin.lng], [destLoc.lat, destLoc.lng]],
              {
                color: '#fbbf24',
                weight: 1.5,
                opacity: 0.5,
                dashArray: '5, 10',
              }
            )
            line.bindPopup(`
              <div style="color: #e2e8f0;">
                <strong>${origin.name} -> ${destLoc.name}</strong><br/>
                <span style="color: #94a3b8;">Flights: ${dest.flightCount}</span>
              </div>
            `)
            line.addTo(map)
          }
        })
      })
    }

    // Highlight known properties
    if (filters.showProperties) {
      KNOWN_PROPERTIES.forEach((prop) => {
        L.circleMarker([prop.lat, prop.lng], {
          radius: 12,
          fillColor: '#f87171',
          color: '#fbbf24',
          weight: 2,
          fillOpacity: 0.9,
        })
          .bindPopup(`<strong style="color: #e2e8f0;">${prop.name}</strong><br/><span style="color: #f87171;">Known Epstein Property</span>`)
          .addTo(map)
      })
    }
  }, [locations, filters, onLocationClick])

  return (
    <div ref={mapRef} className="h-full w-full" />
  )
}
```

#### Map Controls Component — `components/map/MapControls.tsx`

Filter panel for the map: location types, date range, entity filter, and overlays.

```tsx
// components/map/MapControls.tsx
'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import type { MapFilters } from '@/types/map'

const LOCATION_TYPES = [
  { value: 'property', label: 'Properties', color: '#f87171' },
  { value: 'city', label: 'Cities', color: '#60a5fa' },
  { value: 'country', label: 'Countries', color: '#4ade80' },
  { value: 'venue', label: 'Venues', color: '#c084fc' },
]

interface MapControlsProps {
  filters: MapFilters
  onFiltersChange: (filters: MapFilters) => void
}

export function MapControls({ filters, onFiltersChange }: MapControlsProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  const toggleLocationType = (type: string) => {
    const current = filters.locationTypes
    const updated = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type]
    onFiltersChange({ ...filters, locationTypes: updated })
  }

  return (
    <Card className="w-64 border-border bg-surface/95 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm">Map Filters</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setIsExpanded(!isExpanded)}>
          {isExpanded ? 'Hide' : 'Show'}
        </Button>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          {/* Location Type Filters */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Location Types</Label>
            {LOCATION_TYPES.map(({ value, label, color }) => (
              <div key={value} className="flex items-center gap-2">
                <Checkbox
                  id={`loc-${value}`}
                  checked={filters.locationTypes.includes(value)}
                  onCheckedChange={() => toggleLocationType(value)}
                />
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
                <Label htmlFor={`loc-${value}`} className="text-xs">{label}</Label>
              </div>
            ))}
          </div>

          <Separator />

          {/* Date Range */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Date Range</Label>
            <Input
              type="date"
              value={filters.dateFrom || ''}
              onChange={(e) => onFiltersChange({ ...filters, dateFrom: e.target.value || null })}
              className="h-8 text-xs"
            />
            <Input
              type="date"
              value={filters.dateTo || ''}
              onChange={(e) => onFiltersChange({ ...filters, dateTo: e.target.value || null })}
              className="h-8 text-xs"
            />
          </div>

          <Separator />

          {/* Entity Filter */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Filter by entity</Label>
            <Input placeholder="Search entities..." className="h-8 text-xs" />
          </div>

          <Separator />

          {/* Overlays */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Flight routes</Label>
              <Switch
                checked={filters.showFlightRoutes}
                onCheckedChange={(checked) =>
                  onFiltersChange({ ...filters, showFlightRoutes: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Known properties</Label>
              <Switch
                checked={filters.showProperties}
                onCheckedChange={(checked) =>
                  onFiltersChange({ ...filters, showProperties: checked })
                }
              />
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
```

#### Map Sidebar Component — `components/map/MapSidebar.tsx`

Location detail sidebar showing documents, entities, and activity timeline.

```tsx
// components/map/MapSidebar.tsx
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import type { MapLocation } from '@/types/map'

interface MapSidebarProps {
  location: MapLocation
}

export function MapSidebar({ location }: MapSidebarProps) {
  return (
    <div className="mt-4 space-y-6">
      {/* Location info */}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Type</span>
          <Badge variant="outline">{location.locationType}</Badge>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Coordinates</span>
          <span className="text-xs">{location.lat.toFixed(4)}, {location.lng.toFixed(4)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Total mentions</span>
          <span>{location.mentionCount}</span>
        </div>
      </div>

      <Separator />

      {/* Associated entities */}
      {location.topEntities && location.topEntities.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-muted-foreground">Associated Entities</h4>
          <div className="flex flex-wrap gap-1">
            {location.topEntities.map((name) => (
              <Badge key={name} variant="secondary" className="text-xs">
                {name}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <Separator />

      {/* Documents mentioning this location */}
      {location.documents && location.documents.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-muted-foreground">
            Documents ({location.documents.length})
          </h4>
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {location.documents.map((doc) => (
              <Link
                key={doc.id}
                href={`/document/${doc.id}`}
                className="block rounded-lg border border-border bg-surface p-2 transition-colors hover:bg-surface-elevated"
              >
                <p className="text-xs font-medium">{doc.filename}</p>
                {doc.date && (
                  <p className="text-xs text-muted-foreground">{doc.date}</p>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      <Separator />

      {/* Activity timeline at this location */}
      {location.activityTimeline && location.activityTimeline.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-muted-foreground">Activity Timeline</h4>
          <div className="space-y-2">
            {location.activityTimeline.map((event, i) => (
              <div key={i} className="flex gap-2 text-xs">
                <span className="whitespace-nowrap text-muted-foreground">{event.date}</span>
                <span>{event.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

### Step 7: Build the Cascade Replay animation

#### Cascade Replay Page — `app/(public)/cascade/[id]/page.tsx`

Full-screen cascade replay with animated tree growth and OG meta tags for sharing.

```tsx
// app/(public)/cascade/[id]/page.tsx
import { Metadata } from 'next'
import { CascadeReplayWrapper } from '@/components/gamification/CascadeReplayWrapper'
import { EmptyState } from '@/components/shared/EmptyState'

interface CascadePageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: CascadePageProps): Promise<Metadata> {
  const { id } = await params

  // Will fetch cascade data from API in production
  // For now, return generic metadata
  return {
    title: `Cascade Impact | Epstein Archive`,
    description: `A single discovery in the Epstein files cascaded to multiple matches across documents.`,
    openGraph: {
      title: `Cascade Impact: Discovery Chain`,
      description: `A single discovery in the Epstein files cascaded to multiple matches across documents. View the full cascade replay.`,
      type: 'website',
    },
  }
}

export default async function CascadePage({ params }: CascadePageProps) {
  const { id } = await params

  // Will fetch cascade tree from API: GET /api/gamification/cascade-replay/{id}
  const cascadeData = null as null | {
    id: string
    rootRedactionId: string
    rootText: string
    totalNodes: number
    totalDocuments: number
    nodes: Array<{
      id: string
      text: string
      documentId: string
      documentFilename: string
      depth: number
      parentId: string | null
    }>
  }

  if (!cascadeData) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
        <EmptyState
          variant="no-results"
          title="Cascade Not Found"
          description="This cascade replay doesn't exist or hasn't been generated yet. Cascades are created when a solved redaction unlocks matches in other documents."
        />
      </div>
    )
  }

  return (
    <div className="relative h-[calc(100vh-4rem)] w-full overflow-hidden bg-background">
      <CascadeReplayWrapper cascadeData={cascadeData} />
    </div>
  )
}
```

#### Cascade Replay Wrapper — `components/gamification/CascadeReplayWrapper.tsx`

Client wrapper that dynamically imports the heavy animation component.

```tsx
// components/gamification/CascadeReplayWrapper.tsx
'use client'

import dynamic from 'next/dynamic'
import { LoadingState } from '@/components/shared/LoadingState'

const CascadeReplay = dynamic(
  () => import('@/components/gamification/CascadeReplay').then(mod => ({ default: mod.CascadeReplay })),
  {
    ssr: false,
    loading: () => <LoadingState variant="page" />,
  }
)

interface CascadeReplayWrapperProps {
  cascadeData: {
    id: string
    rootRedactionId: string
    rootText: string
    totalNodes: number
    totalDocuments: number
    nodes: Array<{
      id: string
      text: string
      documentId: string
      documentFilename: string
      depth: number
      parentId: string | null
    }>
  }
}

export function CascadeReplayWrapper({ cascadeData }: CascadeReplayWrapperProps) {
  return <CascadeReplay cascadeData={cascadeData} />
}
```

#### Cascade Replay Component — `components/gamification/CascadeReplay.tsx`

Animated cascade replay using Framer Motion for tree growth animation.

```tsx
// components/gamification/CascadeReplay.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import Link from 'next/link'

interface CascadeNode {
  id: string
  text: string
  documentId: string
  documentFilename: string
  depth: number
  parentId: string | null
}

interface CascadeReplayProps {
  cascadeData: {
    id: string
    rootRedactionId: string
    rootText: string
    totalNodes: number
    totalDocuments: number
    nodes: CascadeNode[]
  }
}

export function CascadeReplay({ cascadeData }: CascadeReplayProps) {
  const [visibleDepth, setVisibleDepth] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState<'1x' | '2x' | '5x'>('1x')
  const [showTally, setShowTally] = useState(false)

  const maxDepth = Math.max(...cascadeData.nodes.map((n) => n.depth), 0)

  const speedMs = { '1x': 1500, '2x': 750, '5x': 300 }

  // Auto-play animation
  useEffect(() => {
    if (!isPlaying) return

    const timer = setTimeout(() => {
      if (visibleDepth < maxDepth) {
        setVisibleDepth((d) => d + 1)
      } else {
        setIsPlaying(false)
        setShowTally(true)
      }
    }, speedMs[speed])

    return () => clearTimeout(timer)
  }, [isPlaying, visibleDepth, maxDepth, speed])

  const handlePlay = useCallback(() => {
    if (visibleDepth >= maxDepth) {
      // Reset and play
      setVisibleDepth(0)
      setShowTally(false)
    }
    setIsPlaying(true)
  }, [visibleDepth, maxDepth])

  const handleReset = useCallback(() => {
    setIsPlaying(false)
    setVisibleDepth(0)
    setShowTally(false)
  }, [])

  const visibleNodes = cascadeData.nodes.filter((n) => n.depth <= visibleDepth)

  // Group nodes by depth for layered display
  const nodesByDepth: Record<number, CascadeNode[]> = {}
  visibleNodes.forEach((node) => {
    if (!nodesByDepth[node.depth]) nodesByDepth[node.depth] = []
    nodesByDepth[node.depth].push(node)
  })

  return (
    <div className="flex h-full flex-col">
      {/* Cascade visualization area */}
      <div className="flex-1 overflow-auto p-8">
        <div className="mx-auto max-w-4xl">
          {/* Root node (the original solved redaction) */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="mb-8 flex justify-center"
          >
            <div className="rounded-xl border-2 border-accent bg-accent/10 px-6 py-4 text-center shadow-lg shadow-accent/20">
              <Badge variant="outline" className="mb-2">Original Discovery</Badge>
              <p className="text-sm font-medium">{cascadeData.rootText}</p>
            </div>
          </motion.div>

          {/* Cascade layers */}
          {Array.from({ length: maxDepth + 1 }, (_, depth) => {
            if (depth === 0) return null // Root is shown above
            const depthNodes = nodesByDepth[depth] || []
            if (depthNodes.length === 0) return null

            return (
              <AnimatePresence key={depth}>
                {visibleDepth >= depth && (
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1 - depth * 0.15, y: 0 }}
                    transition={{ duration: 0.5, staggerChildren: 0.1 }}
                    className="mb-6"
                  >
                    <div className="mb-2 flex justify-center">
                      <span className="text-xs text-muted-foreground">
                        Cascade depth {depth} ({depthNodes.length} match{depthNodes.length !== 1 ? 'es' : ''})
                      </span>
                    </div>
                    <div className="flex flex-wrap justify-center gap-3">
                      {depthNodes.slice(0, 200).map((node, i) => (
                        <motion.div
                          key={node.id}
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: i * 0.05, duration: 0.3 }}
                        >
                          <Link href={`/document/${node.documentId}`}>
                            <div className="max-w-48 rounded-lg border border-border bg-surface p-3 transition-colors hover:bg-surface-elevated">
                              <p className="text-xs font-medium line-clamp-2">{node.text}</p>
                              <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                                {node.documentFilename}
                              </p>
                            </div>
                          </Link>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            )
          })}

          {/* Final tally */}
          <AnimatePresence>
            {showTally && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8 }}
                className="mt-12 text-center"
              >
                <div className="mx-auto max-w-md rounded-xl border border-accent bg-accent/5 p-8">
                  <h2 className="mb-2 text-2xl font-bold text-accent">Cascade Impact</h2>
                  <p className="text-lg text-muted-foreground">
                    This discovery unlocked{' '}
                    <span className="font-bold text-primary">{cascadeData.totalNodes}</span>{' '}
                    connections across{' '}
                    <span className="font-bold text-primary">{cascadeData.totalDocuments}</span>{' '}
                    documents.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Controls bar */}
      <div className="border-t border-border bg-surface/95 px-6 py-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={isPlaying ? () => setIsPlaying(false) : handlePlay}>
              {isPlaying ? 'Pause' : 'Play'}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleReset}>Reset</Button>
            <Select value={speed} onValueChange={(val) => setSpeed(val as typeof speed)}>
              <SelectTrigger className="h-8 w-20 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1x">1x</SelectItem>
                <SelectItem value="2x">2x</SelectItem>
                <SelectItem value="5x">5x</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="text-sm text-muted-foreground">
            Depth: {visibleDepth} / {maxDepth}
          </div>

          <Button variant="outline" size="sm" onClick={() => {
            if (navigator.share) {
              navigator.share({
                title: 'Cascade Impact',
                url: window.location.href,
              })
            } else {
              navigator.clipboard.writeText(window.location.href)
            }
          }}>
            Share
          </Button>
        </div>
      </div>
    </div>
  )
}
```

### Step 8: Build the Evidence Pinboard

#### Pinboard Page — `app/(auth)/pinboard/page.tsx`

Drag-and-drop evidence board for building investigation theories.

```tsx
// app/(auth)/pinboard/page.tsx
'use client'

import { useState } from 'react'
import { PinboardCanvas } from '@/components/pinboard/PinboardCanvas'
import { AddPinDialog } from '@/components/pinboard/AddPinDialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { EmptyState } from '@/components/shared/EmptyState'

interface Pin {
  id: string
  type: 'document' | 'entity' | 'image' | 'note'
  title: string
  description?: string
  referenceId?: string
  position: { x: number; y: number }
}

interface Connection {
  id: string
  fromPinId: string
  toPinId: string
  label: string
}

interface Board {
  id: string
  name: string
  pins: Pin[]
  connections: Connection[]
  isPublic: boolean
}

export default function PinboardPage() {
  const [boards] = useState<Board[]>([])
  const [activeBoard, setActiveBoard] = useState<Board | null>(null)
  const [showAddPin, setShowAddPin] = useState(false)
  const [gridSnap, setGridSnap] = useState(false)

  if (boards.length === 0 && !activeBoard) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
        <EmptyState
          variant="not-processed"
          title="Evidence Pinboard"
          description="Create investigation boards to organize evidence. Pin documents, entities, images, and notes, then draw connections between them to build your theory. Requires sign-in."
          showFundingCTA
        />
      </div>
    )
  }

  return (
    <div className="relative h-[calc(100vh-4rem)] w-full overflow-hidden">
      {/* Toolbar */}
      <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between border-b border-border bg-surface/95 px-4 py-2 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Select>
            <SelectTrigger className="h-8 w-48 text-sm">
              <SelectValue placeholder="Select board..." />
            </SelectTrigger>
            <SelectContent>
              {boards.map((board) => (
                <SelectItem key={board.id} value={board.id}>{board.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm">New Board</Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Grid snap</Label>
            <Switch checked={gridSnap} onCheckedChange={setGridSnap} />
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowAddPin(true)}>
            Add Pin
          </Button>
          <Button variant="outline" size="sm">Export as Image</Button>
          <Button variant="ghost" size="sm">Share</Button>
        </div>
      </div>

      {/* Canvas */}
      {activeBoard && (
        <PinboardCanvas
          pins={activeBoard.pins}
          connections={activeBoard.connections}
          gridSnap={gridSnap}
        />
      )}

      {/* Add Pin Dialog */}
      <AddPinDialog
        open={showAddPin}
        onOpenChange={setShowAddPin}
        onAddPin={(pin) => {
          // Will add pin to active board via API
          setShowAddPin(false)
        }}
      />
    </div>
  )
}
```

#### Pinboard Canvas Component — `components/pinboard/PinboardCanvas.tsx`

Main canvas with drag-and-drop pins and connection lines.

```tsx
// components/pinboard/PinboardCanvas.tsx
'use client'

import { useRef, useState, useCallback } from 'react'
import { PinItem } from '@/components/pinboard/PinItem'

interface Pin {
  id: string
  type: 'document' | 'entity' | 'image' | 'note'
  title: string
  description?: string
  referenceId?: string
  position: { x: number; y: number }
}

interface Connection {
  id: string
  fromPinId: string
  toPinId: string
  label: string
}

interface PinboardCanvasProps {
  pins: Pin[]
  connections: Connection[]
  gridSnap: boolean
}

export function PinboardCanvas({ pins, connections, gridSnap }: PinboardCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [scale, setScale] = useState(1)
  const [pinPositions, setPinPositions] = useState<Record<string, { x: number; y: number }>>(
    Object.fromEntries(pins.map((p) => [p.id, p.position]))
  )
  const [drawingConnection, setDrawingConnection] = useState<string | null>(null)

  const handlePinDrag = useCallback((pinId: string, newPosition: { x: number; y: number }) => {
    const snapped = gridSnap
      ? { x: Math.round(newPosition.x / 20) * 20, y: Math.round(newPosition.y / 20) * 20 }
      : newPosition
    setPinPositions((prev) => ({ ...prev, [pinId]: snapped }))
  }, [gridSnap])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setScale((s) => Math.max(0.25, Math.min(3, s * delta)))
  }, [])

  return (
    <div
      ref={canvasRef}
      className="h-full w-full cursor-grab overflow-hidden bg-[#0a0a0f] pt-12"
      onWheel={handleWheel}
      style={{
        backgroundImage: 'radial-gradient(circle, #1e293b 1px, transparent 1px)',
        backgroundSize: `${20 * scale}px ${20 * scale}px`,
      }}
    >
      <div
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transformOrigin: '0 0',
        }}
      >
        {/* Connection lines (SVG overlay) */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full">
          {connections.map((conn) => {
            const from = pinPositions[conn.fromPinId]
            const to = pinPositions[conn.toPinId]
            if (!from || !to) return null

            return (
              <g key={conn.id}>
                <line
                  x1={from.x + 100}
                  y1={from.y + 40}
                  x2={to.x + 100}
                  y2={to.y + 40}
                  stroke="#ef4444"
                  strokeWidth="2"
                  strokeDasharray="8 4"
                  opacity="0.6"
                />
                {conn.label && (
                  <text
                    x={(from.x + to.x) / 2 + 100}
                    y={(from.y + to.y) / 2 + 40}
                    fill="#94a3b8"
                    fontSize="11"
                    textAnchor="middle"
                  >
                    {conn.label}
                  </text>
                )}
              </g>
            )
          })}
        </svg>

        {/* Pins */}
        {pins.map((pin) => (
          <PinItem
            key={pin.id}
            pin={pin}
            position={pinPositions[pin.id] || pin.position}
            onDrag={(pos) => handlePinDrag(pin.id, pos)}
            onStartConnection={() => setDrawingConnection(pin.id)}
            isConnecting={drawingConnection !== null}
          />
        ))}
      </div>
    </div>
  )
}
```

#### Pin Item Component — `components/pinboard/PinItem.tsx`

Individual pin on the evidence board.

```tsx
// components/pinboard/PinItem.tsx
'use client'

import { useRef, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface Pin {
  id: string
  type: 'document' | 'entity' | 'image' | 'note'
  title: string
  description?: string
  referenceId?: string
  position: { x: number; y: number }
}

const PIN_TYPE_COLORS: Record<string, string> = {
  document: 'border-blue-500/50',
  entity: 'border-purple-500/50',
  image: 'border-green-500/50',
  note: 'border-amber-500/50',
}

interface PinItemProps {
  pin: Pin
  position: { x: number; y: number }
  onDrag: (position: { x: number; y: number }) => void
  onStartConnection: () => void
  isConnecting: boolean
}

export function PinItem({ pin, position, onDrag, onStartConnection, isConnecting }: PinItemProps) {
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0 })

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y }

    const handleMouseMove = (moveEvent: MouseEvent) => {
      onDrag({
        x: moveEvent.clientX - dragStart.current.x,
        y: moveEvent.clientY - dragStart.current.y,
      })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }, [position, onDrag])

  const borderColor = PIN_TYPE_COLORS[pin.type] || 'border-border'

  return (
    <div
      className="absolute"
      style={{ left: position.x, top: position.y }}
    >
      <Card
        className={`w-48 cursor-grab border-2 bg-surface shadow-lg ${borderColor} ${
          isDragging ? 'cursor-grabbing opacity-90 shadow-xl' : ''
        }`}
        onMouseDown={handleMouseDown}
      >
        <CardContent className="p-3">
          <div className="mb-2 flex items-center justify-between">
            <Badge variant="outline" className="text-xs">{pin.type}</Badge>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 text-xs"
                onClick={onStartConnection}
                title="Draw connection"
              >
                +
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 text-xs text-red-400"
                title="Remove pin"
              >
                x
              </Button>
            </div>
          </div>
          <p className="text-xs font-medium line-clamp-2">{pin.title}</p>
          {pin.description && (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{pin.description}</p>
          )}
        </CardContent>
      </Card>

      {/* Connection anchor points */}
      {isConnecting && (
        <div className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 cursor-crosshair rounded-full border-2 border-accent bg-background" />
      )}
    </div>
  )
}
```

#### Add Pin Dialog — `components/pinboard/AddPinDialog.tsx`

Search and pin items to the evidence board.

```tsx
// components/pinboard/AddPinDialog.tsx
'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface AddPinDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddPin: (pin: { type: string; title: string; description?: string; referenceId?: string }) => void
}

export function AddPinDialog({ open, onOpenChange, onAddPin }: AddPinDialogProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [noteTitle, setNoteTitle] = useState('')
  const [noteText, setNoteText] = useState('')
  const [activeTab, setActiveTab] = useState('search')

  const handleAddNote = () => {
    if (!noteTitle.trim()) return
    onAddPin({ type: 'note', title: noteTitle, description: noteText })
    setNoteTitle('')
    setNoteText('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Pin to Board</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full">
            <TabsTrigger value="search" className="flex-1">Search</TabsTrigger>
            <TabsTrigger value="note" className="flex-1">Text Note</TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm">Search documents, entities, or images</Label>
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="min-h-32 rounded-lg border border-border p-4 text-center text-sm text-muted-foreground">
              {searchQuery
                ? 'Search results will appear here once the API is connected.'
                : 'Enter a search query to find items to pin.'}
            </div>
          </TabsContent>

          <TabsContent value="note" className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm">Note Title</Label>
              <Input
                placeholder="e.g., Theory: Financial connection"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Note Text</Label>
              <Textarea
                placeholder="Your notes..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                rows={4}
              />
            </div>
            <Button onClick={handleAddNote} disabled={!noteTitle.trim()} className="w-full">
              Add Note Pin
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
```

### Step 9: Build Researcher placeholder pages and API stubs

#### Export Page — `app/(researcher)/export/page.tsx`

```tsx
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
```

#### API Documentation Page — `app/(researcher)/api-docs/page.tsx`

```tsx
// app/(researcher)/api-docs/page.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const API_ENDPOINTS = [
  { method: 'GET', path: '/api/search', description: 'Full-text and semantic search across the corpus' },
  { method: 'GET', path: '/api/entity/:id', description: 'Entity profile with relationships and mentions' },
  { method: 'GET', path: '/api/entity/:id/connections', description: 'Entity relationship graph data' },
  { method: 'GET', path: '/api/graph/path', description: 'Shortest path between two entities' },
  { method: 'GET', path: '/api/timeline', description: 'Timeline events with filtering' },
  { method: 'GET', path: '/api/document/:id', description: 'Document metadata, chunks, and redactions' },
  { method: 'GET', path: '/api/export/entities', description: 'Bulk entity export (CSV/JSON)' },
  { method: 'GET', path: '/api/export/graph', description: 'Full graph export (GraphML/JSON)' },
]

export default function ApiDocsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 lg:px-8">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">API Documentation</h1>
          <Badge variant="outline" className="text-amber-400 border-amber-400/30">Coming Soon</Badge>
        </div>
        <p className="mt-2 text-muted-foreground">
          Programmatic access to the Epstein Archive data for researchers, journalists, and developers.
        </p>
      </div>

      <Card className="mb-8 border-amber-500/20 bg-amber-500/5">
        <CardContent className="pt-6 space-y-2">
          <p className="text-sm text-amber-400">
            API access requires the Researcher tier ($9/month) with API key authentication.
          </p>
          <p className="text-sm text-muted-foreground">
            Rate limits: 100 requests/minute for search, 1000 requests/minute for entity lookups.
            Bulk export endpoints are limited to 10 requests/hour.
          </p>
        </CardContent>
      </Card>

      <h2 className="mb-4 text-xl font-bold">Available Endpoints</h2>
      <div className="space-y-3">
        {API_ENDPOINTS.map(({ method, path, description }) => (
          <Card key={path} className="border-border bg-surface">
            <CardContent className="flex items-center gap-4 py-4">
              <Badge
                variant="outline"
                className={method === 'GET' ? 'text-green-400 border-green-400/30' : 'text-blue-400 border-blue-400/30'}
              >
                {method}
              </Badge>
              <code className="text-sm font-mono text-primary">{path}</code>
              <span className="flex-1 text-sm text-muted-foreground">{description}</span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
```

#### Gamification API Stubs

##### Leaderboard Stub — `app/api/gamification/leaderboard/route.ts`

```typescript
// app/api/gamification/leaderboard/route.ts
import { NextResponse } from 'next/server'

export async function GET() {
  // Stub for Phase 10 implementation
  return NextResponse.json({
    leaderboard: [],
    total_contributors: 0,
    last_updated: new Date().toISOString(),
  })
}
```

##### Achievements Stub — `app/api/gamification/achievements/route.ts`

```typescript
// app/api/gamification/achievements/route.ts
import { NextResponse } from 'next/server'

export async function GET() {
  // Stub for Phase 10 implementation
  return NextResponse.json({
    achievements: [],
    total_available: 0,
  })
}
```

##### Cascade Replay Data — `app/api/gamification/cascade-replay/[id]/route.ts`

```typescript
// app/api/gamification/cascade-replay/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'

interface CascadeReplayParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: CascadeReplayParams) {
  const { id } = await params

  // Will query Supabase recursively following cascade_source_id chain:
  //
  // WITH RECURSIVE cascade_tree AS (
  //   SELECT id, redacted_text, document_id, 0 as depth, NULL as parent_id
  //   FROM redacted_sections
  //   WHERE id = $1
  //   UNION ALL
  //   SELECT r.id, r.redacted_text, r.document_id, ct.depth + 1, ct.id
  //   FROM redacted_sections r
  //   JOIN cascade_tree ct ON r.cascade_source_id = ct.id
  //   WHERE ct.depth < 10  -- limit depth
  // )
  // SELECT * FROM cascade_tree ORDER BY depth, id

  // Stub response
  return NextResponse.json({
    id,
    rootRedactionId: id,
    rootText: '',
    totalNodes: 0,
    totalDocuments: 0,
    nodes: [],
  })
}
```

### Step 10: Update existing components from earlier phases

#### Update CascadeTree — `components/redaction/CascadeTree.tsx`

Replace the static placeholder from Phase 5 with a link to the full animated replay.

```tsx
// components/redaction/CascadeTree.tsx
// Update the existing component to include a link to the full cascade replay page
'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface CascadeTreeProps {
  redactionId: string
  cascadeCount: number
}

export function CascadeTree({ redactionId, cascadeCount }: CascadeTreeProps) {
  if (cascadeCount === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-4 text-center text-sm text-muted-foreground">
        No cascade matches found for this redaction yet.
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold">Cascade Impact</h4>
        <Badge variant="secondary">{cascadeCount} matches</Badge>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        This solved redaction cascaded to {cascadeCount} matching redactions across multiple documents.
      </p>
      <Link href={`/cascade/${redactionId}`}>
        <Button variant="outline" size="sm" className="w-full">
          View Full Cascade Replay
        </Button>
      </Link>
    </div>
  )
}
```

#### Update EntityConnections — `components/entity/EntityConnections.tsx`

Replace the placeholder from Phase 3 with a mini version of the relationship graph.

```tsx
// components/entity/EntityConnections.tsx
// Update existing component to use a mini RelationshipGraph
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
```

### Step 11: Build loading & error states

```tsx
// app/(public)/graph/loading.tsx
import { LoadingState } from '@/components/shared/LoadingState'
export default function GraphLoading() {
  return <LoadingState variant="page" />
}
```

```tsx
// app/(public)/map/loading.tsx
import { LoadingState } from '@/components/shared/LoadingState'
export default function MapLoading() {
  return <LoadingState variant="page" />
}
```

```tsx
// app/(public)/timeline/loading.tsx
import { LoadingState } from '@/components/shared/LoadingState'
export default function TimelineLoading() {
  return <LoadingState variant="page" />
}
```

### Step 12: Verify build

```bash
pnpm build
```

Fix any TypeScript errors. The most common will be:
- Missing type imports (add `@/types/graph`, `@/types/timeline`, `@/types/map`)
- D3 type mismatches (cast simulation node types)
- Leaflet CSS import errors (ensure leaflet CSS is imported in the EvidenceMap component)
- Dynamic import issues (ensure `ssr: false` on all visualization components)

---

## Gotchas

1. **D3 bundle size:** D3.js is ~250KB. It must always be dynamically imported with `ssr: false`. Never import D3 at the top level of a page component. The `RelationshipGraph` component should be the only file that imports D3 directly.

2. **Leaflet CSS:** Leaflet requires its CSS to be loaded. Import `'leaflet/dist/leaflet.css'` directly in the `EvidenceMap` component. Since this component is dynamically imported with `ssr: false`, the CSS will only load when the map is rendered.

3. **Leaflet marker icons:** Leaflet's default marker icons break with webpack. If using default markers (not circle markers), you need to configure the icon paths. Circle markers (`L.circleMarker`) avoid this issue entirely.

4. **Canvas vs SVG for graphs:** SVG is easier to style and interact with but gets slow above ~500 nodes. For production with thousands of entities, switch the `RelationshipGraph` to use an HTML5 Canvas renderer. The D3 force simulation works the same way; only the rendering changes.

5. **Framer Motion tree shaking:** Import only what you need from Framer Motion: `import { motion, AnimatePresence } from 'framer-motion'`. Do not import the entire library. This keeps the cascade replay bundle reasonable.

6. **DnD Kit vs native drag:** The pinboard uses native mouse events for drag-and-drop rather than DnD Kit, because the pinboard needs freeform positioning (not list reordering). DnD Kit is still useful for sortable lists elsewhere.

7. **Server vs Client components:** All visualization pages are client components (`'use client'`) because they use `useState`, D3, Leaflet, and Framer Motion. The cascade page uses a server component wrapper for `generateMetadata` with a client component child.

8. **OG meta tags for cascade pages:** The `generateMetadata` function in the cascade page generates OpenGraph tags for social sharing. In production, it should fetch cascade stats from the database to generate dynamic titles like "Cascade Impact: 47 connections unlocked."

9. **Graph performance with large datasets:** Pre-compute graph layouts server-side for very large graphs (1000+ nodes). Store layout coordinates in the database and pass them as initial positions to the D3 simulation. This avoids long layout computation times on the client.

10. **Map tile provider:** The dark CartoDB tiles (`dark_all`) match the site's dark theme. No API key is required for CartoDB tiles at reasonable usage levels. For high-traffic production, consider Mapbox with a free tier API key.

11. **Temporal graph memory:** The temporal graph pre-computes snapshots at each time step. For graphs with thousands of nodes over decades, this can use significant memory. Limit the granularity (monthly instead of daily) and use web workers for computation.

12. **Pinboard persistence:** Pinboard state needs to be saved to the database. Each board is a JSON blob stored per-user. Auto-save on pin drag/drop with debouncing (500ms) to avoid excessive writes.

---

## Files to Create

```
app/(public)/
├── graph/
│   ├── page.tsx
│   └── loading.tsx
├── timeline/
│   ├── page.tsx
│   └── loading.tsx
├── map/
│   ├── page.tsx
│   └── loading.tsx
├── cascade/[id]/
│   └── page.tsx
app/(auth)/
└── pinboard/
    └── page.tsx
app/(researcher)/
├── export/
│   └── page.tsx
└── api-docs/
    └── page.tsx
app/api/gamification/
├── leaderboard/
│   └── route.ts
├── achievements/
│   └── route.ts
└── cascade-replay/[id]/
    └── route.ts
components/graph/
├── RelationshipGraph.tsx
├── GraphControls.tsx
├── GraphTooltip.tsx
├── PathFinder.tsx
└── TemporalGraph.tsx
components/timeline/
├── TimelineView.tsx
├── TimelineEventCard.tsx
└── TimelineFilters.tsx
components/map/
├── EvidenceMap.tsx
├── MapControls.tsx
└── MapSidebar.tsx
components/pinboard/
├── PinboardCanvas.tsx
├── PinItem.tsx
└── AddPinDialog.tsx
components/gamification/
├── CascadeReplay.tsx
└── CascadeReplayWrapper.tsx
```

## Updates to Existing Files

```
components/redaction/CascadeTree.tsx          — Add link to full cascade replay page
components/entity/EntityConnections.tsx       — Replace placeholder with mini RelationshipGraph
```

## Acceptance Criteria

1. Graph page renders with D3 force simulation (even with empty data showing empty state)
2. Graph nodes are colored by entity type and sized by mention count (log scale)
3. Graph edges show relationship types with varying thickness based on strength
4. Graph zoom, pan, and node drag work smoothly
5. Graph controls: entity type filter checkboxes toggle node visibility, search highlights matching nodes
6. Click node opens entity sidebar with details, click edge shows evidence documents
7. **Path finder:** select two entities, shows shortest connection path with evidence citations
8. **Time slider:** scrubbing animates network evolution over date range with key event markers
9. **Criminal indicator overlay:** toggle colors nodes by risk level (green/yellow/red)
10. Timeline renders vertical layout with alternating left/right event cards
11. Timeline filters work: entity, date range, event type with active filter count
12. Timeline is responsive (single column on mobile, dual column on desktop)
13. Timeline year quick-jump navigation and IntersectionObserver lazy loading work
14. **Geographic map** renders with location pins, flight route lines, and date filtering
15. **Map click** opens sidebar with documents, entities, and activity timeline for that location
16. Map shows known Epstein properties highlighted with special markers
17. Cascade replay animates tree growth with Framer Motion at configurable speed
18. Cascade page has correct OpenGraph meta tags for social sharing
19. Cascade tally shows total connections and documents unlocked
20. **Evidence pinboard** allows drag-and-drop pins with connection drawing (red string visual)
21. Pinboard supports document, entity, image, and text note pins
22. Researcher export page shows "coming soon" with format descriptions
23. Researcher API docs page lists all endpoints with method badges
24. Gamification API stubs return correct empty response shapes
25. Entity connections component shows mini graph for an entity with "View in Full Graph" link
26. CascadeTree component links to full cascade replay page
27. D3, Leaflet, and Framer Motion are dynamically imported (not in main bundle)
28. `pnpm build` succeeds with zero errors

## Performance Notes

- D3 bundle is large (~250KB) — must be dynamically imported with `ssr: false` via `next/dynamic`
- Leaflet + tiles (~200KB) — also dynamically imported with `ssr: false`
- Graph rendering: use SVG for <500 nodes, Canvas for 500+ (swap rendering in RelationshipGraph)
- Timeline: IntersectionObserver loads events in batches of 50 for smooth scrolling with 1000+ events
- Cascade animation: limit to 200 visible nodes per depth level, summarize deeper cascades
- Framer Motion: import only `motion` and `AnimatePresence` — do not import full library
- Pinboard canvas: native mouse drag avoids DnD Kit overhead for freeform positioning
- Temporal graph: pre-compute monthly snapshots to avoid real-time recomputation
- Map clustering: Leaflet MarkerCluster plugin can be added for 500+ location pins
- All heavy components wrapped in `React.lazy()` or `next/dynamic` to split bundles

## Design Notes

- Entity type colors (consistent across graph, timeline, map): Person = `#60a5fa` (blue), Organization = `#c084fc` (purple), Location = `#4ade80` (green), Aircraft = `#fbbf24` (amber), Financial = `#f87171` (red)
- Criminal indicator overlay: Low = green, Medium = yellow, High = red
- Graph background: `bg-background` (dark), edges in `#475569` (slate-600)
- Timeline spine: `bg-border` centered, year markers with `border-accent`
- Map tiles: CartoDB dark_all for dark theme consistency
- Flight routes: `#fbbf24` (amber) dashed lines
- Known properties: red markers with amber border
- Pinboard background: `#0a0a0f` with subtle dot grid
- Pin connection lines: `#ef4444` (red) dashed — "red string" visual metaphor
- Cascade root node: `border-accent bg-accent/10` with `shadow-accent/20` glow

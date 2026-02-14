// components/graph/RelationshipGraph.tsx
'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import * as d3 from 'd3'
import type { GraphNode, GraphEdge, GraphFilters } from '@/types/graph'
import { ENTITY_TYPE_META } from '@/lib/constants/entity-types'

const ENTITY_COLORS: Record<string, string> = Object.fromEntries(
  Object.entries(ENTITY_TYPE_META).map(([k, v]) => [k, v.color])
)

const CRIMINAL_COLORS = {
  low: '#4ade80',
  medium: '#fbbf24',
  high: '#f87171',
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
  entityType: string // kept as string for d3 compat — validated upstream via GraphNode.entityType
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

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({ width: entry.contentRect.width, height: entry.contentRect.height })
      }
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  const filteredNodes = useMemo(
    () => nodes.filter((node) => filters.entityTypes.includes(node.entityType)),
    [nodes, filters.entityTypes]
  )
  const filteredNodeIds = useMemo(
    () => new Set(filteredNodes.map((n) => n.id)),
    [filteredNodes]
  )
  const filteredEdges = useMemo(
    () => edges.filter((edge) => {
      if (!filteredNodeIds.has(edge.sourceId) || !filteredNodeIds.has(edge.targetId)) return false
      if (edge.strength < filters.minConnectionStrength) return false
      return true
    }),
    [edges, filteredNodeIds, filters.minConnectionStrength]
  )

  const nodeRadius = useCallback((mentionCount: number) => {
    return Math.max(4, Math.min(30, 4 + Math.log2(mentionCount + 1) * 3))
  }, [])

  const nodeColor = useCallback((node: SimulationNode) => {
    if (filters.showCriminalIndicators && node.criminalIndicatorScore !== undefined) {
      if (node.criminalIndicatorScore >= 7) return CRIMINAL_COLORS.high
      if (node.criminalIndicatorScore >= 4) return CRIMINAL_COLORS.medium
      return CRIMINAL_COLORS.low
    }
    return ENTITY_COLORS[node.entityType] || '#94a3b8'
  }, [filters.showCriminalIndicators])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg || dimensions.width === 0 || dimensions.height === 0) return
    if (simulationRef.current) simulationRef.current.stop()

    const svgSelection = d3.select(svg)
    svgSelection.selectAll('*').remove()

    const simNodes: SimulationNode[] = filteredNodes.map((n) => ({
      id: n.id, name: n.name, entityType: n.entityType,
      mentionCount: n.mentionCount, connectionCount: n.connectionCount,
      criminalIndicatorScore: n.criminalIndicatorScore,
    }))

    const nodeMap = new Map(simNodes.map((n) => [n.id, n]))
    const simLinks: SimulationLink[] = filteredEdges
      .filter((e) => nodeMap.has(e.sourceId) && nodeMap.has(e.targetId))
      .map((e) => ({
        id: e.id, source: e.sourceId, target: e.targetId,
        relationshipType: e.relationshipType, strength: e.strength,
      }))

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 10])
      .on('zoom', (event) => { container.attr('transform', event.transform) })
    svgSelection.call(zoom)
    const container = svgSelection.append('g')

    const links = container.append('g').attr('class', 'links')
      .selectAll('line').data(simLinks).join('line')
      .attr('stroke', '#475569').attr('stroke-opacity', 0.6)
      .attr('stroke-width', (d) => Math.max(1, d.strength / 3))
      .style('cursor', 'pointer')
      .on('click', (_event, d) => {
        const orig = edges.find((e) => e.id === d.id)
        if (orig) onEdgeClick(orig)
      })
      .on('mouseenter', (event, d) => {
        const orig = edges.find((e) => e.id === d.id)
        if (orig) onEdgeHover(orig, { x: event.clientX, y: event.clientY })
      })
      .on('mouseleave', () => { onEdgeHover(null, { x: 0, y: 0 }) })

    const nodeElements = container.append('g').attr('class', 'nodes')
      .selectAll<SVGGElement, SimulationNode>('g').data(simNodes).join('g')
      .style('cursor', 'pointer')
      .call(
        d3.drag<SVGGElement, SimulationNode>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart()
            d.fx = d.x; d.fy = d.y
          })
          .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0)
            d.fx = null; d.fy = null
          })
      )

    nodeElements.append('circle')
      .attr('r', (d) => nodeRadius(d.mentionCount))
      .attr('fill', (d) => nodeColor(d))
      .attr('stroke', (d) => {
        if (filters.searchHighlight && d.name.toLowerCase().includes(filters.searchHighlight.toLowerCase())) return '#fbbf24'
        return 'rgba(255,255,255,0.2)'
      })
      .attr('stroke-width', (d) => {
        if (filters.searchHighlight && d.name.toLowerCase().includes(filters.searchHighlight.toLowerCase())) return 3
        return 1.5
      })

    nodeElements.append('text')
      .text((d) => d.name.length > 15 ? d.name.slice(0, 13) + '...' : d.name)
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => nodeRadius(d.mentionCount) + 14)
      .attr('fill', '#cbd5e1').attr('font-size', '10px').attr('pointer-events', 'none')

    nodeElements
      .on('click', (_event, d) => {
        const orig = nodes.find((n) => n.id === d.id)
        if (orig) onNodeClick(orig)
      })
      .on('dblclick', (_event, d) => {
        const orig = nodes.find((n) => n.id === d.id)
        if (orig) onNodeDoubleClick(orig)
      })
      .on('mouseenter', (event, d) => {
        const orig = nodes.find((n) => n.id === d.id)
        if (orig) onNodeHover(orig, { x: event.clientX, y: event.clientY })
      })
      .on('mouseleave', () => { onNodeHover(null, { x: 0, y: 0 }) })

    const simulation = d3.forceSimulation(simNodes)
      .force('link', d3.forceLink<SimulationNode, SimulationLink>(simLinks)
        .id((d) => d.id).distance(100).strength((d) => d.strength / 10))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(dimensions.width / 2, dimensions.height / 2))
      .force('collide', d3.forceCollide<SimulationNode>().radius((d) => nodeRadius(d.mentionCount) + 5))
      .on('tick', () => {
        links
          .attr('x1', (d) => (d.source as SimulationNode).x ?? 0)
          .attr('y1', (d) => (d.source as SimulationNode).y ?? 0)
          .attr('x2', (d) => (d.target as SimulationNode).x ?? 0)
          .attr('y2', (d) => (d.target as SimulationNode).y ?? 0)
        nodeElements.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`)
      })

    simulationRef.current = simulation
    return () => { simulation.stop() }
  }, [filteredNodes, filteredEdges, dimensions, filters.searchHighlight, nodeRadius, nodeColor, nodes, edges, onNodeClick, onEdgeClick, onNodeHover, onEdgeHover, onNodeDoubleClick])

  return (
    <div ref={containerRef} className="h-full w-full">
      <svg ref={svgRef} width={dimensions.width} height={dimensions.height} className="bg-background" />
    </div>
  )
}

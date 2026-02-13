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
    left: Math.min(position.x + 12, typeof window !== 'undefined' ? window.innerWidth - 280 : 500),
    top: Math.min(position.y + 12, typeof window !== 'undefined' ? window.innerHeight - 200 : 500),
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
          <div className="flex justify-between"><span>Mentions</span><span>{node.mentionCount}</span></div>
          <div className="flex justify-between"><span>Connections</span><span>{node.connectionCount}</span></div>
          <div className="flex justify-between"><span>Documents</span><span>{node.documentCount}</span></div>
        </div>
        {node.topConnections && node.topConnections.length > 0 && (
          <div className="mt-2 border-t border-border pt-2">
            <span className="text-xs text-muted-foreground">Top connections:</span>
            <div className="mt-1 flex flex-wrap gap-1">
              {node.topConnections.slice(0, 5).map((name) => (
                <Badge key={name} variant="secondary" className="text-xs">{name}</Badge>
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
          <div className="flex justify-between"><span>Strength</span><span>{edge.strength}/10</span></div>
          <div className="flex justify-between"><span>Evidence documents</span><span>{edge.evidenceCount}</span></div>
        </div>
        {edge.description && (
          <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{edge.description}</p>
        )}
      </div>
    )
  }

  return null
}

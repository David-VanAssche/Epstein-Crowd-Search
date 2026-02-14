// types/graph.ts

import type { EntityType } from './entities'

export interface GraphNode {
  id: string
  name: string
  entityType: EntityType
  mentionCount: number
  connectionCount: number
  documentCount: number
  criminalIndicatorScore?: number
  firstSeenDate?: string
  lastSeenDate?: string
  aliases?: string[]
  topConnections?: string[]
}

export interface GraphEdge {
  id: string
  sourceId: string
  targetId: string
  sourceName: string
  targetName: string
  relationshipType: string
  strength: number
  evidenceCount: number
  description?: string
  evidenceDocuments?: Array<{
    id: string
    filename: string
    pageNumber?: number
  }>
}

export interface GraphFilters {
  entityTypes: EntityType[]
  minConnectionStrength: number
  searchHighlight: string
  layout: 'force-directed' | 'radial' | 'hierarchical'
  showCriminalIndicators: boolean
  dateRange: { from: string; to: string } | null
}

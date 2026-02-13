// types/map.ts

export interface MapLocation {
  id: string
  name: string
  lat: number
  lng: number
  locationType: string
  mentionCount: number
  firstMentionDate?: string
  lastMentionDate?: string
  topEntities?: string[]
  documents?: Array<{
    id: string
    filename: string
    date?: string
  }>
  flightConnections?: Array<{
    destinationId: string
    flightCount: number
  }>
  activityTimeline?: Array<{
    date: string
    description: string
  }>
}

export interface MapFilters {
  locationTypes: string[]
  dateFrom: string | null
  dateTo: string | null
  entityIds: string[]
  showFlightRoutes: boolean
  showProperties: boolean
  showAllMentions: boolean
  viewMode: 'pins' | 'heatmap'
}

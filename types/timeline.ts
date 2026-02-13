// types/timeline.ts

export interface TimelineEvent {
  id: string
  date: string
  datePrecision: 'exact' | 'approximate' | 'month' | 'year' | 'unknown'
  eventType: string
  description: string
  location?: string
  entities: Array<{
    id: string
    name: string
    entityType: string
  }>
  sourceDocuments: Array<{
    id: string
    filename: string
    pageNumber?: number
  }>
}

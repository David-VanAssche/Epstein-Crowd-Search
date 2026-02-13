// types/analysis.ts

export interface TemporalActivity {
  activity_type: 'flight' | 'email' | 'timeline_event' | 'financial_transaction'
  activity_id: string
  activity_date: string
  description: string
  related_entity_ids: string[]
  document_id: string
}

export interface FlightPassengerStat {
  entity_id: string
  entity_name: string
  entity_type: string
  flight_count: number
  first_flight_date: string | null
  last_flight_date: string | null
  top_route: string | null
  aircraft_used: string[]
}

export interface EmailCommunicationStat {
  entity_id: string
  entity_name: string
  emails_sent: number
  thread_count: number
  first_email_date: string | null
  last_email_date: string | null
  frequent_contacts: string[]
}

export interface EntityNetworkMetric {
  entity_id: string
  entity_name: string
  entity_type: string
  degree: number
  pagerank: number
  betweenness: number
  cluster_id: number
  mention_count: number
  document_count: number
}

export interface PathStep {
  step_number: number
  entity_id: string
  entity_name: string
  entity_type: string
  relationship_type: string | null
  from_entity_id: string | null
  evidence_document_ids: string[]
  // Enriched fields (added by API)
  evidence_documents?: Array<{ id: string; filename: string; page_number?: number }>
}

export interface PathFinderResponse {
  source: { id: string; name: string; type: string }
  target: { id: string; name: string; type: string }
  path: PathStep[]
  degrees_of_separation: number
}

export interface CentralityEntry {
  entity_id: string
  entity_name: string
  entity_type: string
  degree: number
  pagerank: number
  betweenness: number
  cluster_id: number
}

export interface NetworkCluster {
  cluster_id: number
  entity_count: number
  top_entities: Array<{ id: string; name: string; pagerank: number }>
}

export interface DOJRelease {
  id: string
  title: string
  url: string
  release_date: string
  description: string | null
  document_count: number | null
  is_processed: boolean
  detected_at: string
  metadata: Record<string, unknown>
}

export interface CoTemporalEntity {
  entity_id: string
  entity_name: string
  entity_type: string
  activity_count: number
  activity_types: string[]
}

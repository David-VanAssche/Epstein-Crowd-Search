// types/search.ts

export type SearchTab = 'all' | 'documents' | 'images' | 'videos' | 'entities' | 'audio'

export type SortOption = 'relevance' | 'date_asc' | 'date_desc' | 'mentions'

export interface SearchFilters {
  dataset_id?: string
  doc_type?: string
  date_from?: string
  date_to?: string
  entity_id?: string
  has_redactions?: boolean
  tab?: SearchTab
}

export interface SearchRequest {
  query: string
  filters?: SearchFilters
  page?: number
  per_page?: number
  sort?: SortOption
}

export interface SearchResult {
  chunk_id: string
  document_id: string
  content: string
  contextual_header: string | null
  page_number: number | null
  section_title: string | null
  document_filename: string
  document_classification: string | null
  dataset_name: string | null
  rrf_score: number
  semantic_rank: number | null
  keyword_rank: number | null
  highlight_ranges?: { start: number; end: number }[]
}

export interface MultimodalResult {
  result_id: string
  source_type: 'document' | 'image' | 'video' | 'audio'
  content: string
  document_id: string | null
  page_number: number | null
  storage_path: string | null
  filename: string | null
  dataset_name: string | null
  rrf_score: number
}

export interface SearchResponse {
  results: SearchResult[]
  total_count: number
  query: string
  filters: SearchFilters
  page: number
  per_page: number
  took_ms: number
}

export interface MultimodalSearchResponse {
  results: MultimodalResult[]
  total_count: number
  query: string
  took_ms: number
}

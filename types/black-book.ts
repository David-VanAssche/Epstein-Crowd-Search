// types/black-book.ts

export interface BlackBookEntry {
  id: string
  document_id: string
  name: string
  phones: string[]
  addresses: string[]
  relationships: string[]
  notes: string | null
  linked_entity: {
    id: string
    entity_type: string
    risk_score: number
  } | null
}

export interface BlackBookFilters {
  search: string
  letter: string
}

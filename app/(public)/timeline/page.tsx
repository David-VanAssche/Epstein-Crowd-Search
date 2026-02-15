// app/(public)/timeline/page.tsx
'use client'

import { useState, useMemo, useEffect } from 'react'
import { TimelineView } from '@/components/timeline/TimelineView'
import { TimelineFilters } from '@/components/timeline/TimelineFilters'
import { ProcessingFundingCard } from '@/components/funding/ProcessingFundingCard'
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
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchEvents() {
      setLoading(true)
      try {
        const params = new URLSearchParams({ per_page: '200' })
        if (filters.entityIds.length > 0) {
          params.set('entity_id', filters.entityIds[0])
        }
        if (filters.dateFrom) params.set('date_from', filters.dateFrom)
        if (filters.dateTo) params.set('date_to', filters.dateTo)
        if (filters.eventTypes.length > 0) {
          params.set('event_type', filters.eventTypes[0])
        }

        const res = await fetch(`/api/timeline?${params}`)
        if (!res.ok) {
          setEvents([])
          return
        }

        const json = await res.json()
        const rawEvents = json.data || []

        // Transform DB rows to TimelineEvent type
        const transformed: TimelineEvent[] = rawEvents.map((row: any) => ({
          id: row.id,
          date: row.event_date ? row.event_date.split('T')[0] : '',
          datePrecision: row.date_precision || 'unknown',
          eventType: row.event_type,
          description: row.description,
          location: row.location || undefined,
          entities: (row.entity_ids || []).map((eid: string) => ({
            id: eid,
            name: eid, // Will show UUID until entity resolution is added
            entityType: 'unknown',
          })),
          sourceDocuments: (row.source_document_ids || []).map((did: string) => ({
            id: did,
            filename: did,
          })),
        }))

        setEvents(transformed)
      } catch {
        setEvents([])
      } finally {
        setLoading(false)
      }
    }

    fetchEvents()
  }, [filters])

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

      {loading ? (
        <div className="py-12 text-center text-muted-foreground">Loading timeline events...</div>
      ) : filteredEvents.length > 0 ? (
        <TimelineView events={filteredEvents} />
      ) : (
        <ProcessingFundingCard slug="timeline" />
      )}
    </div>
  )
}

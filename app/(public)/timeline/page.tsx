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

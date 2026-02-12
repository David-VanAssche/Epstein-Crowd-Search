// app/(public)/flights/page.tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import { FlightLogTable } from '@/components/browse/FlightLogTable'
import { FlightLogFilters } from '@/components/browse/FlightLogFilters'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingState } from '@/components/shared/LoadingState'
import { fetchPaginated } from '@/lib/api/client'

interface FlightRecord {
  id: string
  date: string | null
  aircraft: string | null
  origin: string | null
  destination: string | null
  passengers: string[]
  document_id: string
  page_number: number | null
}

export default function FlightsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['flights'],
    queryFn: () => fetchPaginated<FlightRecord>('/api/flights?per_page=100'),
    staleTime: 60_000,
  })

  const flights = data?.items ?? []

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
      <h1 className="mb-2 text-3xl font-bold">Flight Log Explorer</h1>
      <p className="mb-6 text-muted-foreground">
        Structured flight manifest data extracted from the Epstein files.
        Filter by passenger, date, aircraft, or route.
      </p>
      {isLoading ? (
        <LoadingState variant="list" count={10} />
      ) : flights.length > 0 ? (
        <>
          <FlightLogFilters />
          <FlightLogTable flights={flights} />
        </>
      ) : (
        <EmptyState
          variant="not-processed"
          title="Flight Log Explorer"
          description="Flight manifest data will appear here once the flight log documents are processed and structured data is extracted. Known logs include records from aircraft N908JE and others."
          showFundingCTA
        />
      )}
    </div>
  )
}

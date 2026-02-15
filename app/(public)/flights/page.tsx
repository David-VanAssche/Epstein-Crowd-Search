// app/(public)/flights/page.tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import { FlightLogTable } from '@/components/browse/FlightLogTable'
import { FlightLogFilters } from '@/components/browse/FlightLogFilters'
import { ProcessingFundingCard } from '@/components/funding/ProcessingFundingCard'
import { LoadingState } from '@/components/shared/LoadingState'
import { fetchPaginated } from '@/lib/api/client'

interface FlightRecord {
  id: string
  date: string | null
  aircraft: string | null
  tail_number: string | null
  origin: string | null
  destination: string | null
  pilot: string | null
  passengers: string[]
  source: string | null
  document_id: string | null
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
        <ProcessingFundingCard slug="flights" />
      )}
    </div>
  )
}

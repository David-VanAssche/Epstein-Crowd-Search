// app/(public)/flights/page.tsx
'use client'

import { FlightLogTable } from '@/components/browse/FlightLogTable'
import { FlightLogFilters } from '@/components/browse/FlightLogFilters'
import { EmptyState } from '@/components/shared/EmptyState'

export default function FlightsPage() {
  // Will come from structured_data_extractions where extraction_type = 'flight_manifest'
  const flights: Array<{
    id: string
    date: string | null
    aircraft: string | null
    origin: string | null
    destination: string | null
    passengers: string[]
    document_id: string
    page_number: number | null
  }> = []

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
      <h1 className="mb-2 text-3xl font-bold">Flight Log Explorer</h1>
      <p className="mb-6 text-muted-foreground">
        Structured flight manifest data extracted from the Epstein files.
        Filter by passenger, date, aircraft, or route.
      </p>
      {flights.length > 0 ? (
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

// app/(public)/map/page.tsx
'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { LoadingState } from '@/components/shared/LoadingState'
import { EmptyState } from '@/components/shared/EmptyState'
import { MapControls } from '@/components/map/MapControls'
import { MapSidebar } from '@/components/map/MapSidebar'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { MapLocation, MapFilters } from '@/types/map'

const EvidenceMap = dynamic(
  () => import('@/components/map/EvidenceMap').then(mod => ({ default: mod.EvidenceMap })),
  {
    ssr: false,
    loading: () => <LoadingState variant="page" />,
  }
)

export default function MapPage() {
  const [locations] = useState<MapLocation[]>([])
  const [selectedLocation, setSelectedLocation] = useState<MapLocation | null>(null)
  const [filters, setFilters] = useState<MapFilters>({
    locationTypes: ['property', 'city', 'country', 'venue'],
    dateFrom: null,
    dateTo: null,
    entityIds: [],
    showFlightRoutes: true,
    showProperties: true,
    showAllMentions: true,
    viewMode: 'pins',
  })

  if (locations.length === 0) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
        <EmptyState
          variant="not-processed"
          title="Geographic Evidence Map"
          description="The evidence map will show location pins, flight routes, and property markers as documents are processed. Known properties include NYC townhouse, Palm Beach estate, New Mexico ranch, Little St. James island, and Paris apartment."
          showFundingCTA
        />
      </div>
    )
  }

  return (
    <div className="relative h-[calc(100vh-4rem)] w-full overflow-hidden">
      <EvidenceMap
        locations={locations}
        filters={filters}
        onLocationClick={setSelectedLocation}
      />

      <div className="absolute left-4 top-4 z-10">
        <MapControls filters={filters} onFiltersChange={setFilters} />
      </div>

      <Sheet open={!!selectedLocation} onOpenChange={() => setSelectedLocation(null)}>
        <SheetContent side="right" className="w-96 overflow-y-auto">
          {selectedLocation && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedLocation.name}</SheetTitle>
              </SheetHeader>
              <MapSidebar location={selectedLocation} />
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

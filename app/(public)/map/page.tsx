// app/(public)/map/page.tsx
'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { LoadingState } from '@/components/shared/LoadingState'
import { MapControls } from '@/components/map/MapControls'
import { MapSidebar } from '@/components/map/MapSidebar'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { fetchApi } from '@/lib/api/client'
import type { MapLocation, MapFilters } from '@/types/map'

const EvidenceMap = dynamic(
  () => import('@/components/map/EvidenceMap').then(mod => ({ default: mod.EvidenceMap })),
  {
    ssr: false,
    loading: () => <LoadingState variant="page" />,
  }
)

export default function MapPage() {
  const { data: locations = [], isLoading } = useQuery({
    queryKey: ['map', 'locations'],
    queryFn: () => fetchApi<MapLocation[]>('/api/map/locations'),
    staleTime: 300_000,
  })
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

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-var(--topbar-height))] items-center justify-center px-4">
        <LoadingState variant="page" />
      </div>
    )
  }

  if (locations.length === 0) {
    return (
      <div className="flex min-h-[calc(100vh-var(--topbar-height))] items-center justify-center px-4">
        <div className="text-center text-muted-foreground">
          <p className="text-lg font-medium">No location data available yet</p>
          <p className="text-sm">Flight and property locations will appear once data is imported.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-[calc(100vh-var(--topbar-height))] w-full overflow-hidden">
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

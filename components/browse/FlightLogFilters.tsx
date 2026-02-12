// components/browse/FlightLogFilters.tsx
'use client'

import { Input } from '@/components/ui/input'

export function FlightLogFilters() {
  return (
    <div className="mb-6 flex flex-wrap gap-4">
      <Input placeholder="Filter by passenger..." className="max-w-xs" />
      <Input type="date" className="max-w-xs" placeholder="From date" />
      <Input type="date" className="max-w-xs" placeholder="To date" />
      <Input placeholder="Aircraft..." className="max-w-xs" />
    </div>
  )
}

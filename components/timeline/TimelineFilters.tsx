// components/timeline/TimelineFilters.tsx
'use client'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const EVENT_TYPES = [
  'travel', 'meeting', 'legal', 'financial',
  'communication', 'arrest', 'property', 'other',
]

interface TimelineFilterState {
  entityIds: string[]
  dateFrom: string | null
  dateTo: string | null
  eventTypes: string[]
}

interface TimelineFiltersProps {
  filters: TimelineFilterState
  onFiltersChange: (filters: TimelineFilterState) => void
  activeFilterCount: number
}

export function TimelineFilters({ filters, onFiltersChange, activeFilterCount }: TimelineFiltersProps) {
  const handleClearAll = () => {
    onFiltersChange({
      entityIds: [],
      dateFrom: null,
      dateTo: null,
      eventTypes: [],
    })
  }

  const toggleEventType = (type: string) => {
    const current = filters.eventTypes
    const updated = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type]
    onFiltersChange({ ...filters, eventTypes: updated })
  }

  return (
    <div className="mb-8 flex flex-wrap items-center gap-3">
      <Input placeholder="Filter by entity..." className="h-9 max-w-xs text-sm" />

      <Input
        type="date"
        value={filters.dateFrom || ''}
        onChange={(e) => onFiltersChange({ ...filters, dateFrom: e.target.value || null })}
        className="h-9 w-40 text-sm"
        placeholder="From"
      />
      <span className="text-muted-foreground">to</span>
      <Input
        type="date"
        value={filters.dateTo || ''}
        onChange={(e) => onFiltersChange({ ...filters, dateTo: e.target.value || null })}
        className="h-9 w-40 text-sm"
        placeholder="To"
      />

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm">
            Event Type
            {filters.eventTypes.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {filters.eventTypes.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48">
          <div className="space-y-2">
            {EVENT_TYPES.map((type) => (
              <div key={type} className="flex items-center gap-2">
                <Checkbox
                  id={`event-${type}`}
                  checked={filters.eventTypes.includes(type)}
                  onCheckedChange={() => toggleEventType(type)}
                />
                <Label htmlFor={`event-${type}`} className="text-sm capitalize">
                  {type}
                </Label>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {activeFilterCount > 0 && (
        <Button variant="ghost" size="sm" onClick={handleClearAll}>
          Clear all ({activeFilterCount})
        </Button>
      )}
    </div>
  )
}

// components/map/MapControls.tsx
'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import type { MapFilters } from '@/types/map'

const LOCATION_TYPES = [
  { value: 'property', label: 'Properties', color: '#f87171' },
  { value: 'city', label: 'Cities', color: '#60a5fa' },
  { value: 'country', label: 'Countries', color: '#4ade80' },
  { value: 'venue', label: 'Venues', color: '#c084fc' },
]

interface MapControlsProps {
  filters: MapFilters
  onFiltersChange: (filters: MapFilters) => void
}

export function MapControls({ filters, onFiltersChange }: MapControlsProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  const toggleLocationType = (type: string) => {
    const current = filters.locationTypes
    const updated = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type]
    onFiltersChange({ ...filters, locationTypes: updated })
  }

  return (
    <Card className="w-64 border-border bg-surface/95 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm">Map Filters</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setIsExpanded(!isExpanded)}>
          {isExpanded ? 'Hide' : 'Show'}
        </Button>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Location Types</Label>
            {LOCATION_TYPES.map(({ value, label, color }) => (
              <div key={value} className="flex items-center gap-2">
                <Checkbox
                  id={`loc-${value}`}
                  checked={filters.locationTypes.includes(value)}
                  onCheckedChange={() => toggleLocationType(value)}
                />
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
                <Label htmlFor={`loc-${value}`} className="text-xs">{label}</Label>
              </div>
            ))}
          </div>

          <Separator />

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Date Range</Label>
            <Input
              type="date"
              value={filters.dateFrom || ''}
              onChange={(e) => onFiltersChange({ ...filters, dateFrom: e.target.value || null })}
              className="h-8 text-xs"
            />
            <Input
              type="date"
              value={filters.dateTo || ''}
              onChange={(e) => onFiltersChange({ ...filters, dateTo: e.target.value || null })}
              className="h-8 text-xs"
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Filter by entity</Label>
            <Input placeholder="Search entities..." className="h-8 text-xs" />
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Flight routes</Label>
              <Switch
                checked={filters.showFlightRoutes}
                onCheckedChange={(checked) =>
                  onFiltersChange({ ...filters, showFlightRoutes: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Known properties</Label>
              <Switch
                checked={filters.showProperties}
                onCheckedChange={(checked) =>
                  onFiltersChange({ ...filters, showProperties: checked })
                }
              />
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  )
}

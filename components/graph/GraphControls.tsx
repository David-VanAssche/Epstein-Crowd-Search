// components/graph/GraphControls.tsx
'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import type { GraphFilters } from '@/types/graph'

const ENTITY_TYPES = [
  { value: 'person', label: 'People', color: '#60a5fa' },
  { value: 'organization', label: 'Organizations', color: '#c084fc' },
  { value: 'location', label: 'Locations', color: '#4ade80' },
  { value: 'aircraft', label: 'Aircraft', color: '#fbbf24' },
  { value: 'financial_entity', label: 'Financial', color: '#f87171' },
]

interface GraphControlsProps {
  filters: GraphFilters
  onFiltersChange: (filters: GraphFilters) => void
  onToggleFullscreen: () => void
  isFullscreen: boolean
  onTogglePathFinder: () => void
  nodeCount: number
  edgeCount: number
}

export function GraphControls({
  filters, onFiltersChange, onToggleFullscreen, isFullscreen,
  onTogglePathFinder, nodeCount, edgeCount,
}: GraphControlsProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  const toggleEntityType = (type: string) => {
    const updated = filters.entityTypes.includes(type)
      ? filters.entityTypes.filter((t) => t !== type)
      : [...filters.entityTypes, type]
    onFiltersChange({ ...filters, entityTypes: updated })
  }

  return (
    <Card className="w-72 border-border bg-surface/95 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm">Controls</CardTitle>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={onTogglePathFinder}>Path</Button>
          <Button variant="ghost" size="sm" onClick={onToggleFullscreen}>
            {isFullscreen ? 'Exit' : 'Full'}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setIsExpanded(!isExpanded)}>
            {isExpanded ? 'Hide' : 'Show'}
          </Button>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="space-y-4">
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>{nodeCount} entities</span>
            <span>{edgeCount} connections</span>
          </div>
          <Separator />
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Search & Highlight</Label>
            <Input
              placeholder="Search entities..."
              value={filters.searchHighlight}
              onChange={(e) => onFiltersChange({ ...filters, searchHighlight: e.target.value })}
              className="h-8 text-sm"
            />
          </div>
          <Separator />
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Entity Types</Label>
            {ENTITY_TYPES.map(({ value, label, color }) => (
              <div key={value} className="flex items-center gap-2">
                <Checkbox
                  id={`type-${value}`}
                  checked={filters.entityTypes.includes(value)}
                  onCheckedChange={() => toggleEntityType(value)}
                />
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
                <Label htmlFor={`type-${value}`} className="text-xs">{label}</Label>
              </div>
            ))}
          </div>
          <Separator />
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Min Connection Strength: {filters.minConnectionStrength}
            </Label>
            <Slider
              value={[filters.minConnectionStrength]}
              onValueChange={([val]) => onFiltersChange({ ...filters, minConnectionStrength: val })}
              min={0} max={10} step={1}
            />
          </div>
          <Separator />
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Layout</Label>
            <Select
              value={filters.layout}
              onValueChange={(val) => onFiltersChange({ ...filters, layout: val as GraphFilters['layout'] })}
            >
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="force-directed">Force-Directed</SelectItem>
                <SelectItem value="radial">Radial</SelectItem>
                <SelectItem value="hierarchical">Hierarchical</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Criminal indicators</Label>
            <Switch
              checked={filters.showCriminalIndicators}
              onCheckedChange={(checked) => onFiltersChange({ ...filters, showCriminalIndicators: checked })}
            />
          </div>
          {filters.showCriminalIndicators && (
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-green-400" /><span>Low</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-amber-400" /><span>Medium</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-red-400" /><span>High</span>
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}

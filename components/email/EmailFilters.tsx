// components/email/EmailFilters.tsx
'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Search, X } from 'lucide-react'
import type { EmailFiltersState } from '@/lib/hooks/useEmails'

interface EmailFiltersProps {
  filters: EmailFiltersState
  onFiltersChange: (filters: EmailFiltersState) => void
}

export function EmailFilters({ filters, onFiltersChange }: EmailFiltersProps) {
  const hasActive = filters.search || filters.entityId || filters.dateFrom || filters.dateTo || filters.hasAttachments !== null

  return (
    <div className="rounded-lg border border-border bg-surface p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Filters</h3>
        {hasActive && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onFiltersChange({ search: '', entityId: null, dateFrom: null, dateTo: null, hasAttachments: null, threadId: null })}
            className="h-8 gap-1"
          >
            <X className="h-3 w-3" /> Clear
          </Button>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="email-search">Search</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="email-search"
              placeholder="Subject, body, sender..."
              value={filters.search}
              onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
              className="pl-9"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email-date-from">Date From</Label>
          <Input
            id="email-date-from"
            type="date"
            value={filters.dateFrom || ''}
            onChange={(e) => onFiltersChange({ ...filters, dateFrom: e.target.value || null })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email-date-to">Date To</Label>
          <Input
            id="email-date-to"
            type="date"
            value={filters.dateTo || ''}
            onChange={(e) => onFiltersChange({ ...filters, dateTo: e.target.value || null })}
          />
        </div>
        <div className="flex items-end pb-1">
          <div className="flex items-center space-x-2">
            <Switch
              id="email-attachments"
              checked={filters.hasAttachments === true}
              onCheckedChange={(checked) => onFiltersChange({ ...filters, hasAttachments: checked ? true : null })}
            />
            <Label htmlFor="email-attachments" className="cursor-pointer">Has attachments</Label>
          </div>
        </div>
      </div>
    </div>
  )
}

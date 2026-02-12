// components/search/SearchFilters.tsx
'use client'

import { useSearch } from '@/lib/hooks/useSearch'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

export function SearchFilters() {
  const { filters, setFilter } = useSearch()

  return (
    <div className="space-y-6 p-4">
      <h3 className="text-sm font-semibold">Filters</h3>

      {/* Dataset Filter */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Dataset</Label>
        <Select
          value={filters.dataset_id || 'all'}
          onValueChange={(v) => setFilter('dataset', v === 'all' ? null : v)}
        >
          <SelectTrigger><SelectValue placeholder="All datasets" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All datasets</SelectItem>
            {Array.from({ length: 12 }, (_, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>Dataset {i + 1}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Document Type Filter */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Document Type</Label>
        <Select
          value={filters.doc_type || 'all'}
          onValueChange={(v) => setFilter('type', v === 'all' ? null : v)}
        >
          <SelectTrigger><SelectValue placeholder="All types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="deposition">Deposition</SelectItem>
            <SelectItem value="flight_log">Flight Log</SelectItem>
            <SelectItem value="fbi_302">FBI 302</SelectItem>
            <SelectItem value="financial">Financial</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="court_filing">Court Filing</SelectItem>
            <SelectItem value="police_report">Police Report</SelectItem>
            <SelectItem value="correspondence">Correspondence</SelectItem>
            <SelectItem value="photo">Photo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {/* Redaction filter */}
      <div className="flex items-center gap-2">
        <Checkbox
          id="has-redactions"
          checked={filters.has_redactions === true}
          onCheckedChange={(checked) => setFilter('redacted', checked ? 'true' : null)}
        />
        <Label htmlFor="has-redactions" className="text-sm">Has redactions</Label>
      </div>

      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => {
          setFilter('dataset', null)
          setFilter('type', null)
          setFilter('redacted', null)
          setFilter('from', null)
          setFilter('to', null)
        }}
      >
        Clear Filters
      </Button>
    </div>
  )
}

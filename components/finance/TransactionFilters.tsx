// components/finance/TransactionFilters.tsx
'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { X } from 'lucide-react'
import type { FinancialFiltersState } from '@/lib/hooks/useFinancialTransactions'

interface TransactionFiltersProps {
  filters: FinancialFiltersState
  onFiltersChange: (filters: FinancialFiltersState) => void
}

const TRANSACTION_TYPES = [
  { value: '', label: 'All types' },
  { value: 'wire_transfer', label: 'Wire Transfer' },
  { value: 'check', label: 'Check' },
  { value: 'cash', label: 'Cash' },
  { value: 'investment', label: 'Investment' },
  { value: 'donation', label: 'Donation' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'legal_fee', label: 'Legal Fee' },
  { value: 'salary', label: 'Salary' },
  { value: 'loan', label: 'Loan' },
  { value: 'other', label: 'Other' },
]

export function TransactionFilters({ filters, onFiltersChange }: TransactionFiltersProps) {
  const hasActive = filters.minAmount !== null || filters.maxAmount !== null || filters.transactionType || filters.isSuspicious !== null || filters.dateFrom || filters.dateTo

  const clear = () => onFiltersChange({
    minAmount: null, maxAmount: null, transactionType: '', isSuspicious: null, dateFrom: null, dateTo: null,
  })

  return (
    <div className="rounded-lg border border-border bg-surface p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Filters</h3>
        {hasActive && (
          <Button variant="ghost" size="sm" onClick={clear} className="h-8 gap-1">
            <X className="h-3 w-3" /> Clear
          </Button>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-2">
          <Label>Type</Label>
          <Select value={filters.transactionType} onValueChange={(v) => onFiltersChange({ ...filters, transactionType: v })}>
            <SelectTrigger><SelectValue placeholder="All types" /></SelectTrigger>
            <SelectContent>
              {TRANSACTION_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="fin-min">Min Amount ($)</Label>
          <Input
            id="fin-min"
            type="number"
            placeholder="0"
            value={filters.minAmount ?? ''}
            onChange={(e) => onFiltersChange({ ...filters, minAmount: e.target.value ? Number(e.target.value) : null })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fin-max">Max Amount ($)</Label>
          <Input
            id="fin-max"
            type="number"
            placeholder="No limit"
            value={filters.maxAmount ?? ''}
            onChange={(e) => onFiltersChange({ ...filters, maxAmount: e.target.value ? Number(e.target.value) : null })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fin-from">Date From</Label>
          <Input
            id="fin-from"
            type="date"
            value={filters.dateFrom || ''}
            onChange={(e) => onFiltersChange({ ...filters, dateFrom: e.target.value || null })}
          />
        </div>
        <div className="flex items-end pb-1">
          <div className="flex items-center space-x-2">
            <Switch
              id="fin-suspicious"
              checked={filters.isSuspicious === true}
              onCheckedChange={(checked) => onFiltersChange({ ...filters, isSuspicious: checked ? true : null })}
            />
            <Label htmlFor="fin-suspicious" className="cursor-pointer">Suspicious only</Label>
          </div>
        </div>
      </div>
    </div>
  )
}

// components/finance/FinancialSummary.tsx
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DollarSign, AlertTriangle, TrendingUp, Hash } from 'lucide-react'
import { useFinancialSummary } from '@/lib/hooks/useFinancialTransactions'
import { Skeleton } from '@/components/ui/skeleton'

function formatAmount(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

export function FinancialSummary() {
  const { summary, isLoading } = useFinancialSummary()

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}><CardContent className="p-4"><Skeleton className="h-16" /></CardContent></Card>
        ))}
      </div>
    )
  }

  if (!summary) return null

  const stats = [
    { label: 'Total Volume', value: formatAmount(summary.total_amount), icon: DollarSign },
    { label: 'Transactions', value: String(summary.transaction_count), icon: Hash },
    { label: 'Suspicious', value: String(summary.suspicious_count), icon: AlertTriangle },
    { label: 'Types', value: String(summary.by_type.length), icon: TrendingUp },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((s) => {
        const Icon = s.icon
        return (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-surface-elevated p-2">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-xl font-bold">{s.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

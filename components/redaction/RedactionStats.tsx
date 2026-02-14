// components/redaction/RedactionStats.tsx
'use client'

import { Card, CardContent } from '@/components/ui/card'
import { useRedactionStats } from '@/lib/hooks/useRedaction'

export function RedactionStats() {
  const { data: stats, isLoading } = useRedactionStats()

  if (isLoading || !stats) return null

  const items = [
    { label: 'Total Redactions', value: stats.total_redactions },
    { label: 'Unsolved', value: stats.unsolved },
    { label: 'Confirmed', value: stats.confirmed },
    { label: 'Cascades', value: stats.total_cascades },
    { label: 'Contributors', value: stats.total_contributors },
    { label: 'Avg Cascade Depth', value: (stats.avg_cascade_depth ?? 0).toFixed(1) },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      {items.map(({ label, value }) => (
        <Card key={label} className="border-border bg-surface">
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-accent">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

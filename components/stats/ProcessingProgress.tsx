// components/stats/ProcessingProgress.tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { fetchApi } from '@/lib/api/client'

interface Dataset {
  id: string
  dataset_number: number
  name: string
  page_count: number
  processing_status: string
}

export function ProcessingProgress() {
  const { data: datasets } = useQuery({
    queryKey: ['datasets'],
    queryFn: () => fetchApi<Dataset[]>('/api/datasets'),
    staleTime: 300_000,
  })

  const dsArray = datasets ?? []
  const totalPages = dsArray.reduce((sum, ds) => sum + (ds.page_count || 0), 0)
  // Honest: we haven't run the pipeline, so processed = 0
  const processedPages = 0
  const overallPercent = totalPages > 0
    ? Math.round((processedPages / totalPages) * 100)
    : 0

  const perDataset = dsArray.map((ds) => ({
    name: ds.name,
    processed: 0,
    total: ds.page_count || 0,
  }))

  return (
    <Card className="border-border bg-surface">
      <CardHeader>
        <CardTitle>Processing Progress</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <div className="mb-2 flex items-end justify-between">
            <span className="text-sm font-medium">Overall</span>
            <span className="text-2xl font-bold text-primary">
              {processedPages.toLocaleString()} <span className="text-sm text-muted-foreground">of {totalPages.toLocaleString()} pages</span>
            </span>
          </div>
          <Progress value={overallPercent} className="h-4" />
          <p className="mt-1 text-right text-xs text-muted-foreground">{overallPercent}% complete</p>
        </div>

        <div className="space-y-4">
          {perDataset.map((dataset) => {
            const pct = dataset.total > 0
              ? Math.min(100, Math.round((dataset.processed / dataset.total) * 100))
              : 0
            const color = pct >= 100
              ? 'bg-green-500'
              : pct > 0
                ? 'bg-amber-500'
                : 'bg-muted'

            return (
              <div key={dataset.name}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span>{dataset.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {dataset.processed.toLocaleString()} / {dataset.total.toLocaleString()} ({pct}%)
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-label={`${dataset.name} progress`}
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="h-2 w-full overflow-hidden rounded-full bg-muted"
                >
                  <div
                    className={`h-full rounded-full transition-all ${color}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

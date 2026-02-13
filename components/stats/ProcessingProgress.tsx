// components/stats/ProcessingProgress.tsx
'use client'

import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const DATASETS = [
  { name: 'SDNY Court Documents', total_pages: 450000 },
  { name: 'FBI Investigation Files', total_pages: 380000 },
  { name: 'Grand Jury Materials', total_pages: 290000 },
  { name: 'Palm Beach Police Reports', total_pages: 125000 },
  { name: 'Flight Logs & Travel Records', total_pages: 85000 },
  { name: 'Financial Records', total_pages: 520000 },
  { name: 'Correspondence & Communications', total_pages: 340000 },
  { name: 'Deposition Transcripts', total_pages: 210000 },
  { name: 'Victim Impact Statements', total_pages: 95000 },
  { name: 'Property & Asset Records', total_pages: 180000 },
  { name: 'Media & Press Materials', total_pages: 145000 },
  { name: 'Miscellaneous DOJ Files', total_pages: 680000 },
]

interface ProcessingProgressProps {
  stats?: {
    total_pages_processed: number
    total_pages: number
    per_dataset: Array<{ name: string; processed: number; total: number }>
  }
}

export function ProcessingProgress({ stats }: ProcessingProgressProps) {
  const totalPages = stats?.total_pages ?? 3500000
  const processedPages = stats?.total_pages_processed ?? 0
  const overallPercent = totalPages > 0
    ? Math.round((processedPages / totalPages) * 100)
    : 0

  const datasets = stats?.per_dataset ?? DATASETS.map((d) => ({
    name: d.name,
    processed: 0,
    total: d.total_pages,
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
          {datasets.map((dataset) => {
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

// components/stats/CoverageHeatmap.tsx
'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const DATASETS = [
  'SDNY Court Documents',
  'FBI Investigation Files',
  'Grand Jury Materials',
  'Palm Beach Police Reports',
  'Flight Logs',
  'Financial Records',
  'Correspondence',
  'Deposition Transcripts',
  'Victim Statements',
  'Property Records',
  'Media Materials',
  'Misc. DOJ Files',
]

const DOC_TYPES = [
  'PDF Reports',
  'Scanned Images',
  'Audio Transcripts',
  'Video Files',
  'Spreadsheets',
  'Emails',
]

interface CoverageHeatmapProps {
  coverageData?: Record<string, Record<string, number>>
}

function getCellColor(percentage: number): string {
  if (percentage >= 80) return 'bg-green-600/80'
  if (percentage >= 60) return 'bg-green-600/50'
  if (percentage >= 40) return 'bg-amber-500/50'
  if (percentage >= 20) return 'bg-amber-500/30'
  if (percentage > 0) return 'bg-red-500/30'
  return 'bg-muted/30'
}

export function CoverageHeatmap({ coverageData }: CoverageHeatmapProps) {
  const data = useMemo(() => {
    if (coverageData) return coverageData
    const empty: Record<string, Record<string, number>> = {}
    DATASETS.forEach((ds) => {
      empty[ds] = {}
      DOC_TYPES.forEach((dt) => {
        empty[ds][dt] = 0
      })
    })
    return empty
  }, [coverageData])

  const blindSpots = useMemo(() => {
    const spots: Array<{ dataset: string; docType: string; coverage: number }> = []
    DATASETS.forEach((ds) => {
      DOC_TYPES.forEach((dt) => {
        const pct = data[ds]?.[dt] ?? 0
        spots.push({ dataset: ds, docType: dt, coverage: pct })
      })
    })
    return spots.sort((a, b) => a.coverage - b.coverage).slice(0, 5)
  }, [data])

  return (
    <Card className="border-border bg-surface">
      <CardHeader>
        <CardTitle>Corpus Coverage Heatmap</CardTitle>
        <p className="text-sm text-muted-foreground">
          Shows which areas of the corpus have been reviewed by the community. Red/orange areas need attention.
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <TooltipProvider>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className="p-2 text-left text-muted-foreground">Dataset</th>
                  {DOC_TYPES.map((dt) => (
                    <th key={dt} className="p-2 text-center text-muted-foreground">
                      {dt}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DATASETS.map((ds) => (
                  <tr key={ds}>
                    <td className="whitespace-nowrap p-2 font-medium">{ds}</td>
                    {DOC_TYPES.map((dt) => {
                      const pct = data[ds]?.[dt] ?? 0
                      return (
                        <td key={dt} className="p-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Link
                                href={`/search?dataset=${encodeURIComponent(ds)}&type=${encodeURIComponent(dt)}`}
                                className={`flex h-8 items-center justify-center rounded ${getCellColor(pct)} transition-colors hover:ring-2 hover:ring-primary`}
                              >
                                <span className="text-xs font-medium">
                                  {pct > 0 ? `${pct}%` : ''}
                                </span>
                              </Link>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="font-medium">{ds}</p>
                              <p className="text-xs">{dt}: {pct}% reviewed</p>
                              <p className="text-xs text-muted-foreground">Click to browse</p>
                            </TooltipContent>
                          </Tooltip>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </TooltipProvider>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span>Coverage:</span>
          <div className="flex items-center gap-1"><div className="h-3 w-3 rounded bg-muted/30" /> 0%</div>
          <div className="flex items-center gap-1"><div className="h-3 w-3 rounded bg-red-500/30" /> 1-19%</div>
          <div className="flex items-center gap-1"><div className="h-3 w-3 rounded bg-amber-500/30" /> 20-39%</div>
          <div className="flex items-center gap-1"><div className="h-3 w-3 rounded bg-amber-500/50" /> 40-59%</div>
          <div className="flex items-center gap-1"><div className="h-3 w-3 rounded bg-green-600/50" /> 60-79%</div>
          <div className="flex items-center gap-1"><div className="h-3 w-3 rounded bg-green-600/80" /> 80%+</div>
        </div>

        <div className="mt-6 rounded-lg border border-amber-600/30 bg-amber-950/10 p-4">
          <h4 className="mb-2 text-sm font-semibold text-amber-400">Most Under-Researched Areas</h4>
          {blindSpots.every((s) => s.coverage === 0) ? (
            <p className="text-xs text-muted-foreground">
              No documents have been community-reviewed yet. Start by claiming a document to review.
            </p>
          ) : (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {blindSpots.map((spot, i) => (
                <li key={i}>
                  <Link
                    href={`/search?dataset=${encodeURIComponent(spot.dataset)}&type=${encodeURIComponent(spot.docType)}`}
                    className="text-amber-400 hover:underline"
                  >
                    {spot.dataset} / {spot.docType}
                  </Link>
                  {' '}&mdash; {spot.coverage}% reviewed
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// components/stats/CorpusStats.tsx
'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface CorpusStatsData {
  total_documents: number
  total_pages: number
  total_chunks: number
  total_images: number
  total_videos: number
  total_entities: number
  entities_by_type: {
    person: number
    organization: number
    location: number
    aircraft: number
    vessel: number
    property: number
    account: number
  }
  total_relationships: number
  total_redactions: number
  redactions_by_status: {
    solved: number
    proposed: number
    unsolved: number
  }
  total_contributors: number
  total_proposals: number
  accuracy_rate: number
}

interface CorpusStatsProps {
  stats?: CorpusStatsData
}

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (value === 0) {
      setDisplay(0)
      return
    }
    const duration = 1200
    const start = performance.now()
    let rafId: number

    const animate = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      setDisplay(Math.round(value * progress))
      if (progress < 1) {
        rafId = requestAnimationFrame(animate)
      }
    }

    rafId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafId)
  }, [value])

  return (
    <span className="tabular-nums">
      <span aria-hidden="true">{display.toLocaleString()}</span>
      <span className="sr-only">{value.toLocaleString()}</span>
    </span>
  )
}

const STAT_CARDS = [
  { key: 'total_documents', label: 'Documents' },
  { key: 'total_pages', label: 'Pages' },
  { key: 'total_chunks', label: 'Text Chunks' },
  { key: 'total_images', label: 'Images' },
  { key: 'total_videos', label: 'Videos' },
  { key: 'total_entities', label: 'Entities' },
  { key: 'total_relationships', label: 'Relationships' },
  { key: 'total_redactions', label: 'Redactions' },
] as const

export function CorpusStats({ stats }: CorpusStatsProps) {
  const defaultStats: CorpusStatsData = {
    total_documents: 0,
    total_pages: 0,
    total_chunks: 0,
    total_images: 0,
    total_videos: 0,
    total_entities: 0,
    entities_by_type: { person: 0, organization: 0, location: 0, aircraft: 0, vessel: 0, property: 0, account: 0 },
    total_relationships: 0,
    total_redactions: 0,
    redactions_by_status: { solved: 0, proposed: 0, unsolved: 0 },
    total_contributors: 0,
    total_proposals: 0,
    accuracy_rate: 0,
  }

  const s = stats ?? defaultStats

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STAT_CARDS.map(({ key, label }) => (
          <Card key={key} className="border-border bg-surface">
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold text-primary">
                <AnimatedNumber value={s[key]} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border bg-surface">
        <CardHeader>
          <CardTitle className="text-lg">Entities by Type</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(s.entities_by_type).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2">
                <span className="text-sm capitalize">{type}</span>
                <span className="text-sm font-bold">{count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-surface">
        <CardHeader>
          <CardTitle className="text-lg">Redaction Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-green-600/30 bg-green-950/10 p-4 text-center">
              <div className="text-2xl font-bold text-green-400">
                <AnimatedNumber value={s.redactions_by_status.solved} />
              </div>
              <p className="text-sm text-muted-foreground">Solved</p>
            </div>
            <div className="rounded-lg border border-amber-600/30 bg-amber-950/10 p-4 text-center">
              <div className="text-2xl font-bold text-amber-400">
                <AnimatedNumber value={s.redactions_by_status.proposed} />
              </div>
              <p className="text-sm text-muted-foreground">Proposed</p>
            </div>
            <div className="rounded-lg border border-red-600/30 bg-red-950/10 p-4 text-center">
              <div className="text-2xl font-bold text-red-400">
                <AnimatedNumber value={s.redactions_by_status.unsolved} />
              </div>
              <p className="text-sm text-muted-foreground">Unsolved</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-surface">
        <CardHeader>
          <CardTitle className="text-lg">Community Contributors</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                <AnimatedNumber value={s.total_contributors} />
              </div>
              <p className="text-sm text-muted-foreground">Contributors</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                <AnimatedNumber value={s.total_proposals} />
              </div>
              <p className="text-sm text-muted-foreground">Proposals Submitted</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {s.accuracy_rate}%
              </div>
              <p className="text-sm text-muted-foreground">Accuracy Rate</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

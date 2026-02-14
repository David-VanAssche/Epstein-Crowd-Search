'use client'

import { SearchBar } from '@/components/search/SearchBar'
import type { CorpusStats } from '@/types/collaboration'

interface CommandBarProps {
  stats: {
    chunks: number
    entities: number
    sources_ingested: number
    redactions_solved: number
  }
}

export function CommandBar({ stats }: CommandBarProps) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-4">
        <SearchBar />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCounter label="Passages" value={stats.chunks} />
        <StatCounter label="Entities" value={stats.entities} />
        <StatCounter label="Sources" value={stats.sources_ingested} />
        <StatCounter label="Redactions Solved" value={stats.redactions_solved} />
      </div>
    </div>
  )
}

function StatCounter({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="text-xl font-bold tabular-nums text-primary">
        {value.toLocaleString()}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  )
}

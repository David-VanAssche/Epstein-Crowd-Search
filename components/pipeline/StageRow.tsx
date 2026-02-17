'use client'

import { Progress } from '@/components/ui/progress'
import type { LucideIcon } from 'lucide-react'

interface StageRowProps {
  icon: LucideIcon
  label: string
  completed: number
  eligible: number
  /** Show "~" prefix to indicate approximate eligible count */
  isApproximate?: boolean
}

export function StageRow({ icon: Icon, label, completed, eligible, isApproximate }: StageRowProps) {
  const pct = eligible > 0 ? Math.min(100, Math.round((completed / eligible) * 100)) : 0
  const isDone = pct === 100 && eligible > 0

  return (
    <div className="flex items-center gap-3 py-1.5">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="w-40 shrink-0 truncate text-sm">{label}</span>
      <div className="flex-1">
        <Progress value={pct} className="h-1.5" />
      </div>
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
        {isDone ? (
          <span className="text-green-500">{completed.toLocaleString()} ✓</span>
        ) : (
          <>
            {completed.toLocaleString()} / {isApproximate ? '~' : ''}
            {eligible.toLocaleString()}
          </>
        )}
      </span>
      <span className="w-10 shrink-0 text-right text-xs tabular-nums font-medium">
        {pct}%
      </span>
    </div>
  )
}

// components/funding/FundingTracker.tsx
'use client'

import { useEffect, useState } from 'react'
import { Progress } from '@/components/ui/progress'
import { useFundingStatus } from '@/lib/hooks/useFunding'

interface FundingTrackerProps {
  compact?: boolean
}

export function FundingTracker({ compact = false }: FundingTrackerProps) {
  const { data } = useFundingStatus()
  const [displayedAmount, setDisplayedAmount] = useState(0)

  useEffect(() => {
    if (!data) return
    const target = data.raised
    const duration = 1500
    const steps = 60
    const increment = target / steps
    let current = 0
    const timer = setInterval(() => {
      current += increment
      if (current >= target) {
        setDisplayedAmount(target)
        clearInterval(timer)
      } else {
        setDisplayedAmount(Math.round(current))
      }
    }, duration / steps)
    return () => clearInterval(timer)
  }, [data])

  const raised = data?.raised ?? 0
  const goal = data?.goal ?? 16000
  const percentage = data?.percentage ?? 0
  const donorCount = data?.donor_count ?? 0

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <Progress value={percentage} className="h-2 flex-1" />
        <span className="whitespace-nowrap text-sm font-medium">
          ${displayedAmount.toLocaleString()} / ${(goal / 1000).toFixed(0)}K
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="text-5xl font-bold text-primary">
          <span className="tabular-nums">${displayedAmount.toLocaleString()}</span>
        </div>
        <p className="mt-1 text-lg text-muted-foreground">
          raised of <span className="font-semibold text-foreground">${goal.toLocaleString()}</span> goal
        </p>
      </div>

      <div className="relative">
        <Progress value={percentage} className="h-6 rounded-full" />
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-primary/20 blur-md transition-all duration-1000"
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">
          {percentage}%
        </span>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        {donorCount > 0 ? `${donorCount} donors` : 'Be the first donor'}
        {data?.last_updated && (
          <span> &middot; Updated {new Date(data.last_updated).toLocaleDateString()}</span>
        )}
      </p>
    </div>
  )
}

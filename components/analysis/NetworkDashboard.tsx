// components/analysis/NetworkDashboard.tsx
'use client'

import { CentralityLeaderboard } from './CentralityLeaderboard'
import { TemporalHeatmap } from './TemporalHeatmap'

export function NetworkDashboard() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CentralityLeaderboard />
        <TemporalHeatmap />
      </div>
    </div>
  )
}

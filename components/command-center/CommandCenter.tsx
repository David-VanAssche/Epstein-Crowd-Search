'use client'

import { CommandBar } from './CommandBar'
import { LiveActivityFeed } from './LiveActivityFeed'
import { NeedsEyesCompact } from './NeedsEyesCompact'
import { RecentlyViewed } from './RecentlyViewed'
import { UserQuickPanel } from './UserQuickPanel'
import { ThisDayInFiles } from '@/components/discovery/ThisDayInFiles'

interface CommandCenterProps {
  initialStats: {
    chunks: number
    entities: number
    sources_ingested: number
    redactions_solved: number
  }
}

export function CommandCenter({ initialStats }: CommandCenterProps) {
  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Search + Stats Bar */}
      <CommandBar stats={initialStats} />

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Main column */}
        <div className="space-y-6">
          <LiveActivityFeed />
        </div>

        {/* Side column */}
        <div className="space-y-6">
          <UserQuickPanel />
          <NeedsEyesCompact />
          <RecentlyViewed />
          <ThisDayInFiles />
        </div>
      </div>
    </div>
  )
}

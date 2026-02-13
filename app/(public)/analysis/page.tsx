// app/(public)/analysis/page.tsx
'use client'

import { NetworkDashboard } from '@/components/analysis/NetworkDashboard'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Network, GitBranch } from 'lucide-react'

export default function AnalysisPage() {
  return (
    <div className="container max-w-content py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Network Analysis</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Explore relationship centrality metrics, flight patterns, and network clusters across the Epstein archive.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/graph">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Network className="h-4 w-4" /> Graph View
            </Button>
          </Link>
          <Link href="/graph?mode=path">
            <Button variant="outline" size="sm" className="gap-1.5">
              <GitBranch className="h-4 w-4" /> Path Finder
            </Button>
          </Link>
        </div>
      </div>

      <NetworkDashboard />
    </div>
  )
}

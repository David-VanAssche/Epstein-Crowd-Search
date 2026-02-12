// app/(public)/discoveries/page.tsx
'use client'

import { DiscoveryFeed } from '@/components/discovery/DiscoveryFeed'
import { ThisDayInFiles } from '@/components/discovery/ThisDayInFiles'

export default function DiscoveriesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
      <h1 className="mb-2 text-3xl font-bold">Discoveries</h1>
      <p className="mb-8 text-muted-foreground">
        A live feed of confirmed redaction solves, new entity connections,
        and pattern discoveries from the community.
      </p>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-4 text-xl font-semibold">Recent Discoveries</h2>
          <DiscoveryFeed />
        </div>
        <div>
          <ThisDayInFiles />
        </div>
      </div>
    </div>
  )
}

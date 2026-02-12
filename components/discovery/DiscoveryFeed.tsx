// components/discovery/DiscoveryFeed.tsx
'use client'

import { useDiscoveries } from '@/lib/hooks/useDiscoveries'
import { DiscoveryCard } from './DiscoveryCard'
import { EmptyState } from '@/components/shared/EmptyState'

export function DiscoveryFeed() {
  const { discoveries, isLoading } = useDiscoveries()

  if (discoveries.length === 0) {
    return (
      <EmptyState
        variant="not-processed"
        title="No Discoveries Yet"
        description="Discoveries will appear here as the community begins solving redactions and finding connections."
        showFundingCTA
      />
    )
  }

  return (
    <div className="space-y-4">
      {discoveries.map((d) => (
        <DiscoveryCard key={d.id} discovery={d} />
      ))}
    </div>
  )
}

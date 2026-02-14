// components/discovery/DiscoveryFeed.tsx
'use client'

import { useDiscoveries } from '@/lib/hooks/useDiscoveries'
import { DiscoveryCard } from './DiscoveryCard'
import { ProcessingFundingCard } from '@/components/funding/ProcessingFundingCard'

export function DiscoveryFeed() {
  const { discoveries, isLoading } = useDiscoveries()

  if (isLoading || discoveries.length === 0) {
    return (
      <ProcessingFundingCard slug="discoveries" variant="inline" />
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

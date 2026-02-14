// components/entity/EntityTimeline.tsx
import { ProcessingFundingCard } from '@/components/funding/ProcessingFundingCard'

interface EntityTimelineProps {
  entityId: string
}

export function EntityTimeline({ entityId }: EntityTimelineProps) {
  return (
    <ProcessingFundingCard slug="entity-timeline" variant="compact" />
  )
}

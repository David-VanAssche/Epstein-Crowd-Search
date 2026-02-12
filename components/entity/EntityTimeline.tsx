// components/entity/EntityTimeline.tsx
import { EmptyState } from '@/components/shared/EmptyState'

interface EntityTimelineProps {
  entityId: string
}

export function EntityTimeline({ entityId }: EntityTimelineProps) {
  // Will fetch from API in Phase 4
  return (
    <EmptyState
      variant="not-processed"
      title="Entity Timeline"
      description="A chronological timeline of this entity's appearances across the documents."
    />
  )
}

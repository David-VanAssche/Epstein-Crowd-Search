// components/entity/EntityMentions.tsx
import { EmptyState } from '@/components/shared/EmptyState'

interface EntityMentionsProps {
  entityId: string
}

export function EntityMentions({ entityId }: EntityMentionsProps) {
  // Will fetch from API in Phase 4
  return (
    <EmptyState
      variant="not-processed"
      title="Document Mentions"
      description="Document mentions will appear as documents are processed and entities are extracted."
    />
  )
}

// components/entity/EntityMentions.tsx
import { ProcessingFundingCard } from '@/components/funding/ProcessingFundingCard'

interface EntityMentionsProps {
  entityId: string
}

export function EntityMentions({ entityId }: EntityMentionsProps) {
  return (
    <ProcessingFundingCard slug="entity-mentions" variant="compact" />
  )
}

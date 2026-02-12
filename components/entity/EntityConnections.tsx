// components/entity/EntityConnections.tsx
import { EmptyState } from '@/components/shared/EmptyState'

interface EntityConnectionsProps {
  entityId: string
}

export function EntityConnections({ entityId }: EntityConnectionsProps) {
  // Mini relationship graph will be added in Phase 8 (D3 visualization)
  return (
    <EmptyState
      variant="coming-soon"
      title="Entity Connections"
      description="An interactive graph showing this entity's relationships will appear here once the entity graph is built."
    />
  )
}

// app/(public)/entity/[id]/page.tsx
import { EntityProfile } from '@/components/entity/EntityProfile'
import { EmptyState } from '@/components/shared/EmptyState'
import type { Entity } from '@/types/entities'

interface EntityPageProps {
  params: Promise<{ id: string }>
}

export default async function EntityPage({ params }: EntityPageProps) {
  const { id } = await params

  // Will fetch from Supabase in Phase 4
  const entity: Entity | null = null

  if (!entity) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <EmptyState
          variant="not-processed"
          title="Entity Not Found"
          description="This entity hasn't been extracted yet, or the ID is invalid."
          showFundingCTA
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
      <EntityProfile entity={entity} />
    </div>
  )
}

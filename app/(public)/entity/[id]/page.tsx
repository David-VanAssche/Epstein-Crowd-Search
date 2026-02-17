// app/(public)/entity/[id]/page.tsx
'use client'

import { use, useEffect } from 'react'
import { EntityProfile } from '@/components/entity/EntityProfile'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingState } from '@/components/shared/LoadingState'
import { useEntity } from '@/lib/hooks/useEntity'
import { setBreadcrumbLabel } from '@/lib/breadcrumbs'

interface EntityPageProps {
  params: Promise<{ id: string }>
}

export default function EntityPage({ params }: EntityPageProps) {
  const { id } = use(params)
  const { entity, isLoading } = useEntity(id)

  useEffect(() => {
    if (entity?.name) {
      setBreadcrumbLabel(id, entity.name)
    }
  }, [id, entity?.name])

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
        <LoadingState variant="page" />
      </div>
    )
  }

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

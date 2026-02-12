// app/(public)/entities/page.tsx
'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { EntityCard } from '@/components/entity/EntityCard'
import { EmptyState } from '@/components/shared/EmptyState'
import type { EntityType } from '@/types/entities'

export default function EntitiesPage() {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | EntityType>('all')

  // Will fetch from API in Phase 4
  const entities: Array<{
    id: string
    name: string
    entity_type: EntityType
    mention_count: number
    document_count: number
  }> = []

  const filtered = entities.filter((e) => {
    if (typeFilter !== 'all' && e.entity_type !== typeFilter) return false
    if (search && !e.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
      <h1 className="mb-6 text-3xl font-bold">Entities</h1>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row">
        <Input
          placeholder="Search entities..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <Tabs value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="person">People</TabsTrigger>
          <TabsTrigger value="organization">Organizations</TabsTrigger>
          <TabsTrigger value="location">Locations</TabsTrigger>
        </TabsList>

        <TabsContent value={typeFilter} className="mt-6">
          {filtered.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((entity) => (
                <EntityCard key={entity.id} entity={entity} />
              ))}
            </div>
          ) : (
            <EmptyState
              variant="not-processed"
              title="No Entities Yet"
              description="Entities are extracted automatically as documents are processed. Help fund processing to discover the people, organizations, and locations in the files."
              showFundingCTA
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

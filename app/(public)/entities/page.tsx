// app/(public)/entities/page.tsx
'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { EntityCard } from '@/components/entity/EntityCard'
import { ProcessingFundingCard } from '@/components/funding/ProcessingFundingCard'
import { LoadingState } from '@/components/shared/LoadingState'
import { fetchPaginated } from '@/lib/api/client'
import type { EntityType } from '@/types/entities'

interface EntityListItem {
  id: string
  name: string
  entity_type: EntityType
  mention_count: number
  document_count: number
}

export default function EntitiesPage() {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | EntityType>('all')

  const { data, isLoading } = useQuery({
    queryKey: ['entities', typeFilter],
    queryFn: () => {
      const params = new URLSearchParams({ per_page: '100' })
      if (typeFilter !== 'all') params.set('type', typeFilter)
      return fetchPaginated<EntityListItem>(`/api/entity?${params}`)
    },
    staleTime: 60_000,
  })

  const entities = data?.items ?? []
  const filtered = entities.filter((e) => {
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
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="person">People</TabsTrigger>
          <TabsTrigger value="organization">Organizations</TabsTrigger>
          <TabsTrigger value="location">Locations</TabsTrigger>
          <TabsTrigger value="aircraft">Aircraft</TabsTrigger>
          <TabsTrigger value="vessel">Vessels</TabsTrigger>
          <TabsTrigger value="property">Properties</TabsTrigger>
          <TabsTrigger value="account">Accounts</TabsTrigger>
          <TabsTrigger value="event">Events</TabsTrigger>
          <TabsTrigger value="legal_case">Legal Cases</TabsTrigger>
          <TabsTrigger value="government_body">Gov Bodies</TabsTrigger>
          <TabsTrigger value="trust">Trusts</TabsTrigger>
          <TabsTrigger value="phone_number">Phone Numbers</TabsTrigger>
          <TabsTrigger value="vehicle">Vehicles</TabsTrigger>
          <TabsTrigger value="document_reference">Doc References</TabsTrigger>
        </TabsList>

        <TabsContent value={typeFilter} className="mt-6">
          {isLoading ? (
            <LoadingState variant="card" count={6} />
          ) : filtered.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((entity) => (
                <EntityCard key={entity.id} entity={entity} />
              ))}
            </div>
          ) : (
            <ProcessingFundingCard slug="entities" />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

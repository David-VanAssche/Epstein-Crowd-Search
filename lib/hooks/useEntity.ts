// lib/hooks/useEntity.ts
'use client'

import { useQuery } from '@tanstack/react-query'
import type { Entity, EntityMention, EntityConnectionNode } from '@/types/entities'

export function useEntity(entityId: string) {
  const { data: entity, isLoading } = useQuery<Entity>({
    queryKey: ['entity', entityId],
    queryFn: async () => {
      const res = await fetch(`/api/entity/${entityId}`)
      if (!res.ok) throw new Error('Entity fetch failed')
      return res.json()
    },
    enabled: !!entityId,
  })

  const { data: mentions } = useQuery<EntityMention[]>({
    queryKey: ['entity', entityId, 'mentions'],
    queryFn: async () => {
      const res = await fetch(`/api/entity/${entityId}?include=mentions`)
      if (!res.ok) throw new Error('Mentions fetch failed')
      return res.json()
    },
    enabled: !!entityId,
  })

  const { data: connections } = useQuery<EntityConnectionNode[]>({
    queryKey: ['entity', entityId, 'connections'],
    queryFn: async () => {
      const res = await fetch(`/api/entity/${entityId}/connections`)
      if (!res.ok) throw new Error('Connections fetch failed')
      return res.json()
    },
    enabled: !!entityId,
  })

  return {
    entity: entity ?? null,
    mentions: mentions ?? [],
    connections: connections ?? [],
    isLoading,
  }
}

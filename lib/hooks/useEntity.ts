// lib/hooks/useEntity.ts
'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchApi } from '@/lib/api/client'
import type { Entity, EntityMention, EntityConnectionNode } from '@/types/entities'

export function useEntity(entityId: string) {
  const { data: entity, isLoading: entityLoading } = useQuery<Entity>({
    queryKey: ['entity', entityId],
    queryFn: () => fetchApi<Entity>(`/api/entity/${entityId}`),
    enabled: !!entityId,
  })

  const { data: mentions, isLoading: mentionsLoading } = useQuery<EntityMention[]>({
    queryKey: ['entity', entityId, 'mentions'],
    queryFn: () => fetchApi<EntityMention[]>(`/api/entity/${entityId}?include=mentions`),
    enabled: !!entityId,
  })

  const { data: connections, isLoading: connectionsLoading } = useQuery<EntityConnectionNode[]>({
    queryKey: ['entity', entityId, 'connections'],
    queryFn: () => fetchApi<EntityConnectionNode[]>(`/api/entity/${entityId}/connections`),
    enabled: !!entityId,
  })

  return {
    entity: entity ?? null,
    mentions: mentions ?? [],
    connections: connections ?? [],
    isLoading: entityLoading || mentionsLoading || connectionsLoading,
  }
}

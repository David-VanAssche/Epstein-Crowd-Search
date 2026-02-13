// lib/hooks/usePropertyOwnership.ts
'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchApi } from '@/lib/api/client'

interface OwnershipRecord {
  id: string
  owner_id?: string
  owner_name?: string
  property_id?: string
  property_name?: string
  from_date: string | null
  to_date: string | null
  acquisition_type: string | null
  acquisition_amount: number | null
  shell_company: boolean
  shell_company_name: string | null
  notes: string | null
}

interface OwnershipData {
  entity: { id: string; name: string; type: string }
  as_property: OwnershipRecord[]
  as_owner: OwnershipRecord[]
}

export function usePropertyOwnership(entityId: string) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['property-ownership', entityId],
    queryFn: () => fetchApi<OwnershipData>(`/api/entity/${entityId}/ownership`),
    enabled: !!entityId,
    staleTime: 60_000,
  })

  return {
    entity: data?.entity ?? null,
    asProperty: data?.as_property ?? [],
    asOwner: data?.as_owner ?? [],
    isLoading,
    error,
  }
}

// lib/hooks/useDiscoveries.ts
'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchApi } from '@/lib/api/client'

interface Discovery {
  id: string
  type: 'redaction_solved' | 'entity_connection' | 'pattern_found'
  title: string
  description: string
  user_display_name: string | null
  cascade_count: number
  created_at: string
}

interface TodayInHistoryDocument {
  id: string
  filename: string
  date: string
  date_extracted?: string | null
  [key: string]: unknown
}

export function useDiscoveries() {
  const { data, isLoading } = useQuery<Discovery[]>({
    queryKey: ['discoveries'],
    queryFn: () => fetchApi<Discovery[]>('/api/discoveries'),
    staleTime: 60_000,
  })

  return {
    discoveries: data ?? [],
    isLoading,
  }
}

export function useTodayInHistory() {
  const { data, isLoading } = useQuery({
    queryKey: ['today-in-history'],
    queryFn: () => fetchApi<{ documents: TodayInHistoryDocument[] }>('/api/discoveries/today-in-history'),
    staleTime: 3600_000, // 1 hour
  })

  return {
    documents: data?.documents ?? [],
    isLoading,
  }
}

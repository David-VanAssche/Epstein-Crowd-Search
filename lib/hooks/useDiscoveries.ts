// lib/hooks/useDiscoveries.ts
'use client'

import { useQuery } from '@tanstack/react-query'

interface Discovery {
  id: string
  type: 'redaction_solved' | 'entity_connection' | 'pattern_found'
  title: string
  description: string
  user_display_name: string | null
  cascade_count: number
  created_at: string
}

export function useDiscoveries() {
  const { data, isLoading } = useQuery<Discovery[]>({
    queryKey: ['discoveries'],
    queryFn: async () => {
      const res = await fetch('/api/discoveries')
      if (!res.ok) throw new Error('Failed to fetch discoveries')
      return res.json()
    },
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
    queryFn: async () => {
      const res = await fetch('/api/discoveries/today-in-history')
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
    staleTime: 3600_000, // 1 hour
  })

  return {
    documents: data?.documents ?? [],
    isLoading,
  }
}

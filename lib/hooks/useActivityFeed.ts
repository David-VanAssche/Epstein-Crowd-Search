'use client'

import { useQuery } from '@tanstack/react-query'

export interface ActivityItem {
  id: string
  type: 'redaction' | 'connection' | 'processing' | 'discovery' | 'bounty'
  description: string
  timestamp: string
  link: string | null
  actor: string | null
}

export function useActivityFeed(type?: string) {
  return useQuery<ActivityItem[]>({
    queryKey: ['activity-feed', type],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (type && type !== 'all') params.set('type', type)
      params.set('limit', '20')
      const res = await fetch(`/api/activity-feed?${params}`)
      if (!res.ok) return []
      const json = await res.json()
      return json.data ?? []
    },
    refetchInterval: 30_000,
  })
}

'use client'

import { useQuery } from '@tanstack/react-query'
import type { CampaignListResponse, CampaignDetailResponse } from '@/types/campaigns'

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)
  return res.json()
}

export function useCampaigns() {
  return useQuery<CampaignListResponse>({
    queryKey: ['campaigns'],
    queryFn: () => fetchJson<CampaignListResponse>('/api/campaigns'),
    staleTime: 60_000,
  })
}

export function useCampaign(slug: string) {
  return useQuery<CampaignDetailResponse>({
    queryKey: ['campaigns', slug],
    queryFn: () => fetchJson<CampaignDetailResponse>(`/api/campaigns/${slug}`),
    staleTime: 60_000,
    enabled: !!slug,
  })
}

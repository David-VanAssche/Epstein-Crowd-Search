'use client'

import { useQuery } from '@tanstack/react-query'

interface FundingStatus {
  raised: number
  goal: number
  percentage: number
  donor_count: number
  last_updated: string
}

interface DonationImpact {
  amount: number
  pages: number
  entities_estimated: number
  analogy: string
  cost_per_page: number
}

interface SpendLogEntry {
  id: string
  created_at: string
  amount: number
  service: string
  description: string
  pages_processed: number
  entities_extracted: number
  redactions_detected: number
}

interface SpendLogResponse {
  entries: SpendLogEntry[]
  total: number
  page: number
  limit: number
  total_pages: number
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)
  return res.json()
}

export function useFundingStatus() {
  return useQuery<FundingStatus>({
    queryKey: ['funding', 'status'],
    queryFn: () => fetchJson<FundingStatus>('/api/funding/status'),
    refetchInterval: 15 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
  })
}

export function useDonationImpact(amount: number) {
  return useQuery<DonationImpact>({
    queryKey: ['funding', 'impact', amount],
    queryFn: () => fetchJson<DonationImpact>(`/api/funding/impact?amount=${amount}`),
    enabled: amount > 0,
  })
}

export function useSpendLog(options?: {
  page?: number
  limit?: number
  service?: string
  date_from?: string
  date_to?: string
}) {
  const params = new URLSearchParams()
  if (options?.page) params.set('page', String(options.page))
  if (options?.limit) params.set('limit', String(options.limit))
  if (options?.service) params.set('service', options.service)
  if (options?.date_from) params.set('date_from', options.date_from)
  if (options?.date_to) params.set('date_to', options.date_to)

  return useQuery<SpendLogResponse>({
    queryKey: ['funding', 'spend-log', options],
    queryFn: () => fetchJson<SpendLogResponse>(`/api/funding/spend-log?${params.toString()}`),
  })
}

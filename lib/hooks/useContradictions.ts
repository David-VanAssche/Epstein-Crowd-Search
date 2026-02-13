// lib/hooks/useContradictions.ts
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchPaginated, fetchApi } from '@/lib/api/client'

interface ContradictionItem {
  id: string
  claim_a: string
  claim_b: string
  severity: string
  description: string | null
  verify_count: number
  dispute_count: number
  is_verified: boolean
  entity_ids: string[]
  tags: string[]
  created_at: string
  claim_a_document_filename: string | null
  claim_b_document_filename: string | null
}

export function useContradictions(severity: string = '', page: number = 1) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['contradictions', severity, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), per_page: '20' })
      if (severity) params.set('severity', severity)
      return fetchPaginated<ContradictionItem>(`/api/contradictions?${params}`)
    },
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })

  return {
    contradictions: data?.items ?? [],
    total: data?.total ?? 0,
    isLoading,
    error,
  }
}

export function useContradictionVote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, vote }: { id: string; vote: 'verify' | 'dispute' }) => {
      return fetchApi(`/api/contradictions/${id}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote }),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contradictions'] })
    },
  })
}

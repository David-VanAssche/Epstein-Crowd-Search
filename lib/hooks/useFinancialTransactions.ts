// lib/hooks/useFinancialTransactions.ts
'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchPaginated, fetchApi } from '@/lib/api/client'
import type { FinancialTransaction } from '@/types/structured-data'

export interface FinancialFiltersState {
  minAmount: number | null
  maxAmount: number | null
  transactionType: string
  isSuspicious: boolean | null
  dateFrom: string | null
  dateTo: string | null
}

interface FinancialSummary {
  total_amount: number
  transaction_count: number
  suspicious_count: number
  by_type: { type: string; count: number; total: number }[]
  by_year: { year: number; count: number; total: number }[]
  top_senders: { entity_id: string; name: string; total: number }[]
  top_receivers: { entity_id: string; name: string; total: number }[]
}

export function useFinancialTransactions(filters: FinancialFiltersState, page: number = 1) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['financial-transactions', filters, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), per_page: '20' })
      if (filters.minAmount !== null) params.set('min_amount', String(filters.minAmount))
      if (filters.maxAmount !== null) params.set('max_amount', String(filters.maxAmount))
      if (filters.transactionType) params.set('transaction_type', filters.transactionType)
      if (filters.isSuspicious !== null) params.set('is_suspicious', String(filters.isSuspicious))
      if (filters.dateFrom) params.set('date_from', filters.dateFrom)
      if (filters.dateTo) params.set('date_to', filters.dateTo)
      return fetchPaginated<FinancialTransaction>(`/api/financial-transactions?${params}`)
    },
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })

  return {
    transactions: data?.items ?? [],
    total: data?.total ?? 0,
    isLoading,
    error,
  }
}

export function useFinancialSummary() {
  const { data, isLoading } = useQuery({
    queryKey: ['financial-summary'],
    queryFn: () => fetchApi<FinancialSummary>('/api/financial-transactions/summary'),
    staleTime: 60_000,
  })

  return { summary: data ?? null, isLoading }
}

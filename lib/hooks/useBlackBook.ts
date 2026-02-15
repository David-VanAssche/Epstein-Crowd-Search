// lib/hooks/useBlackBook.ts
'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchPaginated } from '@/lib/api/client'
import type { BlackBookEntry, BlackBookFilters } from '@/types/black-book'

export function useBlackBook(filters: BlackBookFilters, page: number = 1) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['black-book', filters, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), per_page: '100' })
      if (filters.search) params.set('search', filters.search)
      if (filters.letter) params.set('letter', filters.letter)
      return fetchPaginated<BlackBookEntry>(`/api/black-book?${params}`)
    },
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  })

  return {
    entries: data?.items ?? [],
    total: data?.total ?? 0,
    page: data?.page ?? 1,
    hasMore: data?.has_more ?? false,
    isLoading,
    error,
  }
}

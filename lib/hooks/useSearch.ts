// lib/hooks/useSearch.ts
'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useMemo } from 'react'
import { fetchPaginated } from '@/lib/api/client'
import type { SearchFilters, SearchResult, SearchTab } from '@/types/search'

export function useSearch() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const query = searchParams.get('q') || ''
  const tab = (searchParams.get('tab') as SearchTab) || 'all'
  const page = parseInt(searchParams.get('page') || '1', 10)

  const filters: SearchFilters = useMemo(() => ({
    dataset_id: searchParams.get('dataset') || undefined,
    doc_type: searchParams.get('type') || undefined,
    date_from: searchParams.get('from') || undefined,
    date_to: searchParams.get('to') || undefined,
    entity_id: searchParams.get('entity') || undefined,
    has_redactions: searchParams.get('redacted') === 'true' ? true : undefined,
    tab,
  }), [searchParams, tab])

  const { data, isLoading, error } = useQuery({
    queryKey: ['search', query, filters, page],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.set('q', query)
      params.set('page', String(page))
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) params.set(key, String(value))
      })
      return fetchPaginated<SearchResult>(`/api/search?${params}`)
    },
    enabled: query.length > 0,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })

  const setQuery = useCallback((newQuery: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('q', newQuery)
    params.set('page', '1')
    router.push(`/search?${params}`)
  }, [router, searchParams])

  const setTab = useCallback((newTab: SearchTab) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', newTab)
    params.set('page', '1')
    router.push(`/search?${params}`)
  }, [router, searchParams])

  const setFilter = useCallback((key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    params.set('page', '1')
    router.push(`/search?${params}`)
  }, [router, searchParams])

  return {
    query,
    tab,
    page,
    filters,
    results: data?.items ?? [],
    totalCount: data?.total ?? 0,
    isLoading,
    error,
    setQuery,
    setTab,
    setFilter,
  }
}

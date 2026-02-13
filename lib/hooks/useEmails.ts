// lib/hooks/useEmails.ts
'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchPaginated } from '@/lib/api/client'

interface EmailListItem {
  id: string
  subject: string | null
  from_raw: string | null
  from_entity_name: string | null
  to_raw: string[]
  sent_date: string | null
  has_attachments: boolean
  thread_id: string | null
  document_id: string
  document_filename: string | null
}

export interface EmailFiltersState {
  search: string
  entityId: string | null
  dateFrom: string | null
  dateTo: string | null
  hasAttachments: boolean | null
  threadId: string | null
}

export function useEmails(filters: EmailFiltersState, page: number = 1) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['emails', filters, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), per_page: '20' })
      if (filters.search) params.set('search', filters.search)
      if (filters.entityId) params.set('entity_id', filters.entityId)
      if (filters.dateFrom) params.set('date_from', filters.dateFrom)
      if (filters.dateTo) params.set('date_to', filters.dateTo)
      if (filters.hasAttachments !== null) params.set('has_attachments', String(filters.hasAttachments))
      if (filters.threadId) params.set('thread_id', filters.threadId)
      return fetchPaginated<EmailListItem>(`/api/emails?${params}`)
    },
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })

  return {
    emails: data?.items ?? [],
    total: data?.total ?? 0,
    page: data?.page ?? 1,
    hasMore: data?.has_more ?? false,
    isLoading,
    error,
  }
}

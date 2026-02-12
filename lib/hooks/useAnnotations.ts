// lib/hooks/useAnnotations.ts
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchApi } from '@/lib/api/client'
import type { Annotation, AnnotationType } from '@/types/collaboration'

export function useAnnotations(documentId: string) {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['annotations', documentId],
    queryFn: () => fetchApi<Annotation[]>(`/api/annotations?document_id=${documentId}`),
    enabled: !!documentId,
    staleTime: 30_000,
  })

  const createAnnotation = useMutation({
    mutationFn: async ({
      content,
      annotationType,
      chunkId,
      pageNumber,
      parentId,
    }: {
      content: string
      annotationType: AnnotationType
      chunkId?: string
      pageNumber?: number
      parentId?: string
    }) => {
      return fetchApi<Annotation>('/api/annotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_id: documentId,
          content,
          annotation_type: annotationType,
          chunk_id: chunkId,
          page_number: pageNumber,
          parent_id: parentId,
        }),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['annotations', documentId] })
    },
  })

  const voteAnnotation = useMutation({
    mutationFn: async ({ annotationId, voteType }: { annotationId: string; voteType: 'upvote' | 'downvote' }) => {
      return fetchApi(`/api/annotations/${annotationId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote_type: voteType }),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['annotations', documentId] })
    },
  })

  return {
    annotations: data ?? [],
    isLoading,
    createAnnotation,
    voteAnnotation,
  }
}

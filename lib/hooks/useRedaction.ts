// lib/hooks/useRedaction.ts
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchApi, fetchPaginated } from '@/lib/api/client'
import type { SolvableRedaction, RedactionStats, RedactionProposal } from '@/types/redaction'

export function useSolvableRedactions(page = 1) {
  return useQuery({
    queryKey: ['redactions', 'solvable', page],
    queryFn: () =>
      fetchPaginated<SolvableRedaction>(`/api/redactions/solvable?page=${page}&per_page=20`),
    staleTime: 30_000,
  })
}

export function useRedactionStats() {
  return useQuery({
    queryKey: ['redactions', 'stats'],
    queryFn: () => fetchApi<RedactionStats>('/api/redactions/dashboard'),
    staleTime: 60_000,
  })
}

export function useRedactionProposals(redactionId: string) {
  return useQuery({
    queryKey: ['redaction', redactionId, 'proposals'],
    queryFn: () => fetchApi<RedactionProposal[]>(`/api/redactions?redaction_id=${redactionId}`),
    enabled: !!redactionId,
  })
}

export function useSubmitProposal() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      redactionId,
      proposedText,
      evidenceType,
      evidenceDescription,
      evidenceSources,
    }: {
      redactionId: string
      proposedText: string
      evidenceType: string
      evidenceDescription: string
      evidenceSources: string[]
    }) => {
      return fetchApi<RedactionProposal>(`/api/redaction/${redactionId}/propose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposed_text: proposedText,
          evidence_type: evidenceType,
          evidence_description: evidenceDescription,
          evidence_sources: evidenceSources,
        }),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['redactions'] })
    },
  })
}

export function useVoteOnProposal() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      redactionId,
      proposalId,
      voteType,
    }: {
      redactionId: string
      proposalId: string
      voteType: 'upvote' | 'downvote' | 'corroborate'
    }) => {
      return fetchApi(`/api/redaction/${redactionId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposal_id: proposalId, vote_type: voteType }),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['redactions'] })
    },
  })
}

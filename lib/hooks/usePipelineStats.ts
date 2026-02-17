'use client'

import { useQuery } from '@tanstack/react-query'

export interface PipelineFlowStats {
  total_documents: number
  ocr_completed: number
  classified: number
  stage_completed: Record<string, number>
  classification_breakdown: Record<string, number>
}

interface ApiEnvelope {
  data: PipelineFlowStats | null
  error: string | null
}

export function usePipelineStats() {
  return useQuery<PipelineFlowStats>({
    queryKey: ['pipeline-stats'],
    queryFn: async () => {
      const res = await fetch('/api/pipeline/stats')
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)
      const json: ApiEnvelope = await res.json()
      if (json.error || !json.data) throw new Error(json.error ?? 'No data returned')
      return json.data
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: 1,
  })
}

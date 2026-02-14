'use client'

import { useQuery } from '@tanstack/react-query'

export interface StageCount {
  completed: number
  total: number
}

export interface PipelineStatsResponse {
  data: {
    by_status: Record<string, number>
    by_media_type: {
      pdf: number
      image: number
      video: number
      audio: number
    }
    total_documents: number
    total_pages: number
    by_stage: Record<string, StageCount>
  }
  error: string | null
}

export function usePipelineStats() {
  return useQuery<PipelineStatsResponse>({
    queryKey: ['pipeline-stats'],
    queryFn: async () => {
      const res = await fetch('/api/pipeline/stats')
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)
      return res.json()
    },
    staleTime: 60_000,
  })
}

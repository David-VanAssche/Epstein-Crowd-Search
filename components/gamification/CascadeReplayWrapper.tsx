// components/gamification/CascadeReplayWrapper.tsx
'use client'

import dynamic from 'next/dynamic'
import { LoadingState } from '@/components/shared/LoadingState'

const CascadeReplay = dynamic(
  () => import('@/components/gamification/CascadeReplay').then(mod => ({ default: mod.CascadeReplay })),
  {
    ssr: false,
    loading: () => <LoadingState variant="page" />,
  }
)

interface CascadeReplayWrapperProps {
  cascadeData: {
    id: string
    rootRedactionId: string
    rootText: string
    totalNodes: number
    totalDocuments: number
    nodes: Array<{
      id: string
      text: string
      documentId: string
      documentFilename: string
      depth: number
      parentId: string | null
    }>
  }
}

export function CascadeReplayWrapper({ cascadeData }: CascadeReplayWrapperProps) {
  return <CascadeReplay cascadeData={cascadeData} />
}

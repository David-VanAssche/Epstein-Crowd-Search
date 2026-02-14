// app/(public)/cascade/[id]/page.tsx
import { Metadata } from 'next'
import { CascadeReplayWrapper } from '@/components/gamification/CascadeReplayWrapper'
import { EmptyState } from '@/components/shared/EmptyState'

interface CascadePageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: CascadePageProps): Promise<Metadata> {
  const { id } = await params

  return {
    title: `Cascade Impact | Epstein Crowd Research`,
    description: `A single discovery in the Epstein files cascaded to multiple matches across documents.`,
    openGraph: {
      title: `Cascade Impact: Discovery Chain`,
      description: `A single discovery in the Epstein files cascaded to multiple matches across documents. View the full cascade replay.`,
      type: 'website',
    },
  }
}

export default async function CascadePage({ params }: CascadePageProps) {
  const { id } = await params

  // Will fetch cascade tree from API: GET /api/gamification/cascade-replay/{id}
  const cascadeData = null as null | {
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

  if (!cascadeData) {
    return (
      <div className="flex min-h-[calc(100vh-var(--topbar-height))] items-center justify-center px-4">
        <EmptyState
          variant="no-results"
          title="Cascade Not Found"
          description="This cascade replay doesn't exist or hasn't been generated yet. Cascades are created when a solved redaction unlocks matches in other documents."
        />
      </div>
    )
  }

  return (
    <div className="relative h-[calc(100vh-var(--topbar-height))] w-full overflow-hidden bg-background">
      <CascadeReplayWrapper cascadeData={cascadeData} />
    </div>
  )
}

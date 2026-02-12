// app/(public)/document/[id]/page.tsx
import { DocumentViewer } from '@/components/document/DocumentViewer'
import { DocumentSummary } from '@/components/document/DocumentSummary'
import { DocumentMetadata } from '@/components/document/DocumentMetadata'
import { DocumentCompleteness } from '@/components/document/DocumentCompleteness'
import { ChunkNavigator } from '@/components/document/ChunkNavigator'
import { RelatedDocuments } from '@/components/document/RelatedDocuments'
import { ContentWarning } from '@/components/document/ContentWarning'
import { EmptyState } from '@/components/shared/EmptyState'

interface DocumentPageProps {
  params: Promise<{ id: string }>
}

export default async function DocumentPage({ params }: DocumentPageProps) {
  const { id } = await params

  // Will fetch from Supabase in Phase 4. For now, return null to show empty state.
  const document = null as null | {
    id: string
    filename: string
    classification: string | null
    dataset_name: string | null
    page_count: number | null
    date_extracted: string | null
    ocr_text: string | null
    is_redacted: boolean
    metadata: Record<string, unknown>
    chunks: Array<{ id: string; content: string; page_number: number | null; contextual_header: string | null }>
    redactions: Array<{ id: string; status: string; page_number: number | null; surrounding_text: string }>
  }

  if (!document) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <EmptyState
          variant="not-processed"
          title="Document Not Yet Available"
          description="This document hasn't been processed yet, or the ID is invalid. Documents become searchable as they are funded and processed."
          showFundingCTA
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 px-4 py-6 lg:flex-row lg:px-8">
      {/* Main Content */}
      <div className="flex-1 space-y-6">
        <ContentWarning />
        <DocumentSummary document={document} />
        <DocumentViewer chunks={document.chunks} />
      </div>

      {/* Sidebar */}
      <aside className="w-full space-y-6 lg:w-80">
        <DocumentMetadata document={document} />
        <DocumentCompleteness documentId={id} />
        <ChunkNavigator chunks={document.chunks} />
        <RelatedDocuments documentId={id} />
      </aside>
    </div>
  )
}

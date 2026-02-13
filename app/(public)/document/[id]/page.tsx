// app/(public)/document/[id]/page.tsx
import { notFound } from 'next/navigation'
import { DocumentViewer } from '@/components/document/DocumentViewer'
import { DocumentSummary } from '@/components/document/DocumentSummary'
import { DocumentMetadata } from '@/components/document/DocumentMetadata'
import { DocumentCompleteness } from '@/components/document/DocumentCompleteness'
import { ChunkNavigator } from '@/components/document/ChunkNavigator'
import { RelatedDocuments } from '@/components/document/RelatedDocuments'
import { ContentWarning } from '@/components/document/ContentWarning'
import { AnnotationSidebar } from '@/components/annotations/AnnotationSidebar'

interface DocumentPageProps {
  params: Promise<{ id: string }>
}

async function getDocument(id: string) {
  // Validate UUID format before making internal request (prevents SSRF via path traversal)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(id)) return null

  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
      || 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/document/${encodeURIComponent(id)}`, { next: { revalidate: 60 } })
    if (!res.ok) return null
    const json = await res.json()
    return json.data ?? null
  } catch {
    return null
  }
}

export default async function DocumentPage({ params }: DocumentPageProps) {
  const { id } = await params
  const document = await getDocument(id)

  if (!document) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-6 px-4 py-6 lg:flex-row lg:px-8">
      {/* Main Content */}
      <div className="flex-1 space-y-6">
        <ContentWarning />
        <DocumentSummary document={document} />
        <DocumentViewer chunks={document.chunks ?? []} />
      </div>

      {/* Sidebar */}
      <aside className="w-full space-y-6 lg:w-80">
        <DocumentMetadata document={document} />
        <DocumentCompleteness documentId={id} />
        <ChunkNavigator chunks={document.chunks ?? []} />
        <RelatedDocuments documentId={id} />
        <AnnotationSidebar documentId={id} />
      </aside>
    </div>
  )
}

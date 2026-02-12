// app/(public)/photos/page.tsx
'use client'

import { PhotoGallery } from '@/components/browse/PhotoGallery'
import { EmptyState } from '@/components/shared/EmptyState'

export default function PhotosPage() {
  // Will fetch from API in Phase 4
  const images: Array<{
    id: string
    storage_path: string
    filename: string | null
    description: string | null
    page_number: number | null
    document_id: string | null
    is_redacted: boolean
  }> = []

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
      <h1 className="mb-6 text-3xl font-bold">Photo Gallery</h1>
      {images.length > 0 ? (
        <PhotoGallery images={images} />
      ) : (
        <EmptyState
          variant="not-processed"
          title="Photo Gallery"
          description="Photos will appear here as documents are processed. The archive contains thousands of images including surveillance photos, party photos, property images, and more."
          showFundingCTA
        />
      )}
    </div>
  )
}

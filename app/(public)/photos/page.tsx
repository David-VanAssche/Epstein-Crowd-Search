// app/(public)/photos/page.tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import { PhotoGallery } from '@/components/browse/PhotoGallery'
import { ProcessingFundingCard } from '@/components/funding/ProcessingFundingCard'
import { LoadingState } from '@/components/shared/LoadingState'
import { fetchPaginated } from '@/lib/api/client'

interface PhotoItem {
  id: string
  storage_path: string
  filename: string | null
  description: string | null
  page_number: number | null
  document_id: string | null
  is_redacted: boolean
}

export default function PhotosPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['photos'],
    queryFn: () => fetchPaginated<PhotoItem>('/api/photos?per_page=50'),
    staleTime: 60_000,
  })

  const images = data?.items ?? []

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
      <h1 className="mb-6 text-3xl font-bold">Photo Gallery</h1>
      {isLoading ? (
        <LoadingState variant="card" count={6} />
      ) : images.length > 0 ? (
        <PhotoGallery images={images} />
      ) : (
        <ProcessingFundingCard slug="photos" />
      )}
    </div>
  )
}

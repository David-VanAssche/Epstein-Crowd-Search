// components/browse/PhotoGallery.tsx
'use client'

import { useState } from 'react'
import { PhotoLightbox } from './PhotoLightbox'

interface Image {
  id: string
  storage_path: string
  filename: string | null
  description: string | null
  page_number: number | null
  document_id: string | null
  is_redacted: boolean
}

interface PhotoGalleryProps {
  images: Image[]
}

export function PhotoGallery({ images }: PhotoGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  return (
    <>
      <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
        {images.map((image, i) => (
          <div
            key={image.id}
            className="mb-4 cursor-pointer overflow-hidden rounded-lg border border-border bg-surface transition-transform hover:scale-[1.02]"
            onClick={() => setSelectedIndex(i)}
          >
            <div className="aspect-video bg-surface-elevated" />
            {image.description && (
              <p className="p-2 text-xs text-muted-foreground line-clamp-2">{image.description}</p>
            )}
          </div>
        ))}
      </div>
      {selectedIndex !== null && (
        <PhotoLightbox
          images={images}
          currentIndex={selectedIndex}
          onClose={() => setSelectedIndex(null)}
          onNavigate={setSelectedIndex}
        />
      )}
    </>
  )
}

// components/browse/PhotoLightbox.tsx
'use client'

import { Button } from '@/components/ui/button'

interface Image {
  id: string
  storage_path: string
  filename: string | null
  description: string | null
}

interface PhotoLightboxProps {
  images: Image[]
  currentIndex: number
  onClose: () => void
  onNavigate: (index: number) => void
}

export function PhotoLightbox({ images, currentIndex, onClose, onNavigate }: PhotoLightboxProps) {
  const image = images[currentIndex]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90" onClick={onClose}>
      <div className="relative max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
        <Button
          variant="ghost"
          size="sm"
          className="absolute -right-12 top-0 text-white"
          onClick={onClose}
        >
          ✕
        </Button>
        <div className="flex aspect-video items-center justify-center rounded bg-surface-elevated text-muted-foreground">
          {image.filename || 'Image preview'}
        </div>
        <div className="mt-4 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            disabled={currentIndex === 0}
            onClick={() => onNavigate(currentIndex - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            {currentIndex + 1} / {images.length}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={currentIndex === images.length - 1}
            onClick={() => onNavigate(currentIndex + 1)}
          >
            Next
          </Button>
        </div>
        {image.description && (
          <p className="mt-2 text-sm text-muted-foreground">{image.description}</p>
        )}
      </div>
    </div>
  )
}

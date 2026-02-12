// app/(auth)/bookmarks/page.tsx
'use client'

import { EmptyState } from '@/components/shared/EmptyState'

export default function BookmarksPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 lg:px-8">
      <h1 className="mb-6 text-3xl font-bold">Bookmarks</h1>
      <p className="mb-8 text-muted-foreground">
        Documents and entities you&apos;ve saved for later review.
      </p>
      <EmptyState
        variant="coming-soon"
        title="No Bookmarks Yet"
        description="Bookmark documents and entities while browsing the archive. They'll appear here for easy access."
      />
    </div>
  )
}

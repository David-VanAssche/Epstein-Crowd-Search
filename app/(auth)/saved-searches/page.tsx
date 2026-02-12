// app/(auth)/saved-searches/page.tsx
'use client'

import { EmptyState } from '@/components/shared/EmptyState'

export default function SavedSearchesPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 lg:px-8">
      <h1 className="mb-6 text-3xl font-bold">Saved Searches</h1>
      <p className="mb-8 text-muted-foreground">
        Your saved search queries with optional alerts for new results.
      </p>
      <EmptyState
        variant="coming-soon"
        title="No Saved Searches Yet"
        description="Save a search from the search page to get notified when new matching documents are processed."
      />
    </div>
  )
}

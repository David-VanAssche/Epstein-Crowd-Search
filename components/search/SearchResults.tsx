// components/search/SearchResults.tsx
'use client'

import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingState } from '@/components/shared/LoadingState'
import type { SearchTab } from '@/types/search'

interface SearchResultsProps {
  query: string
  tab: SearchTab
}

export function SearchResults({ query, tab }: SearchResultsProps) {
  // Will use useSearch hook once API exists. For now, show empty state.
  const isLoading = false
  const results: never[] = []

  if (isLoading) {
    return <LoadingState variant="list" />
  }

  if (results.length === 0) {
    return (
      <EmptyState
        variant="no-results"
        title="No results yet"
        description={`No results found for "${query}". Documents are still being processed — more results will appear as the corpus grows.`}
        showFundingCTA
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* Results will be rendered here based on tab */}
    </div>
  )
}

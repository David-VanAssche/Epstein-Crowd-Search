// components/search/SearchResults.tsx
'use client'

import { useSearch } from '@/lib/hooks/useSearch'
import { ResultCard } from './ResultCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingState } from '@/components/shared/LoadingState'
import { Button } from '@/components/ui/button'
import type { SearchTab } from '@/types/search'

interface SearchResultsProps {
  query: string
  tab: SearchTab
}

export function SearchResults({ query, tab }: SearchResultsProps) {
  const { results, totalCount, isLoading, page, setQuery } = useSearch()

  if (isLoading) {
    return <LoadingState variant="list" count={5} />
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
      <p className="text-sm text-muted-foreground">
        {totalCount.toLocaleString()} result{totalCount !== 1 ? 's' : ''} for &ldquo;{query}&rdquo;
      </p>
      {results.map((result) => (
        <ResultCard
          key={result.chunk_id}
          chunkId={result.chunk_id}
          documentId={result.document_id}
          content={result.content}
          contextualHeader={result.contextual_header}
          pageNumber={result.page_number}
          documentFilename={result.document_filename}
          documentClassification={result.document_classification}
          datasetName={result.dataset_name}
          rrfScore={result.rrf_score}
        />
      ))}
    </div>
  )
}

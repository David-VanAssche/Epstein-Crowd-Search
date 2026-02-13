// components/search/SearchResults.tsx
'use client'

import { useSearch } from '@/lib/hooks/useSearch'
import { ResultCard } from './ResultCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingState } from '@/components/shared/LoadingState'

interface SearchResultsProps {
  query: string
}

export function SearchResults({ query }: SearchResultsProps) {
  const { results, totalCount, isLoading } = useSearch()

  if (isLoading) {
    return <LoadingState variant="list" count={5} />
  }

  if (results.length === 0) {
    return (
      <EmptyState
        variant="no-results"
        title="No matches found"
        description={`No results for "${query}". Try rephrasing as a natural language question — this search understands meaning, not just keywords.`}
        showFundingCTA
      />
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {totalCount.toLocaleString()} semantic match{totalCount !== 1 ? 'es' : ''} for &ldquo;{query}&rdquo;
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

// app/(public)/search/page.tsx
'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { SearchBar } from '@/components/search/SearchBar'
import { SearchResults } from '@/components/search/SearchResults'
import { SearchFilters } from '@/components/search/SearchFilters'
import { Sidebar } from '@/components/layout/Sidebar'
import { EmptyState } from '@/components/shared/EmptyState'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { SearchTab } from '@/types/search'

function SearchPageContent() {
  const searchParams = useSearchParams()
  const query = searchParams.get('q') || ''
  const tab = (searchParams.get('tab') as SearchTab) || 'all'

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      {/* Filters Sidebar */}
      <Sidebar>
        <SearchFilters />
      </Sidebar>

      {/* Main Content */}
      <main className="flex-1 px-4 py-6 lg:px-8">
        {/* Search Bar (sticky) */}
        <div className="sticky top-16 z-10 -mx-4 bg-background px-4 pb-4 pt-2 lg:-mx-8 lg:px-8">
          <SearchBar defaultValue={query} />
        </div>

        {/* Tabs */}
        <Tabs value={tab} className="mt-4">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="images">Images</TabsTrigger>
            <TabsTrigger value="audio">Audio</TabsTrigger>
            <TabsTrigger value="videos">Videos</TabsTrigger>
            <TabsTrigger value="entities">Entities</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-4">
            {query ? (
              <SearchResults query={query} tab={tab} />
            ) : (
              <EmptyState
                variant="no-results"
                title="Search the Epstein Files"
                description="Enter a search query to search across 3.5 million pages of DOJ documents, images, audio, and video transcripts."
                showFundingCTA
              />
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchPageContent />
    </Suspense>
  )
}

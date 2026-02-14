// app/(public)/search/page.tsx
'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { FileText, Image, Mic, Video, Users } from 'lucide-react'
import { SearchBar } from '@/components/search/SearchBar'
import { SearchResults } from '@/components/search/SearchResults'
import { SearchFilters } from '@/components/search/SearchFilters'
import { SearchEmptyState } from '@/components/search/SearchEmptyState'
import { FilterPanel } from '@/components/layout/FilterPanel'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { SearchTab } from '@/types/search'

function SearchPageContent() {
  const searchParams = useSearchParams()
  const query = searchParams.get('q') || ''
  const tab = (searchParams.get('tab') as SearchTab) || 'all'

  // No query: centered landing mode
  if (!query) {
    return (
      <div className="flex min-h-[calc(100vh-var(--topbar-height))] flex-col items-center justify-center px-4">
        <div className="w-full max-w-2xl">
          <SearchBar />
        </div>
        <div className="mt-10 w-full max-w-2xl">
          <SearchEmptyState />
        </div>
      </div>
    )
  }

  // Has query: results mode with sidebar + tabs
  return (
    <div className="flex min-h-[calc(100vh-var(--topbar-height))]">
      {/* Filters Sidebar */}
      <FilterPanel>
        <SearchFilters />
      </FilterPanel>

      {/* Main Content */}
      <main className="flex-1 px-4 py-6 lg:px-8">
        {/* Search Bar (sticky) */}
        <div className="sticky top-[var(--topbar-height)] z-10 -mx-4 bg-background px-4 pb-4 pt-2 lg:-mx-8 lg:px-8">
          <SearchBar defaultValue={query} />
        </div>

        {/* Tabs */}
        <Tabs value={tab} className="mt-4">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="documents" className="gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Documents
            </TabsTrigger>
            <TabsTrigger value="images" className="gap-1.5">
              <Image className="h-3.5 w-3.5" />
              Images
            </TabsTrigger>
            <TabsTrigger value="audio" className="gap-1.5">
              <Mic className="h-3.5 w-3.5" />
              Audio
            </TabsTrigger>
            <TabsTrigger value="videos" className="gap-1.5">
              <Video className="h-3.5 w-3.5" />
              Videos
            </TabsTrigger>
            <TabsTrigger value="entities" className="gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Entities
            </TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-4">
            <SearchResults query={query} />
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

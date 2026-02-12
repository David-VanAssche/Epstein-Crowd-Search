# Phase 3: Core UI Pages

> **Sessions:** 2 | **Dependencies:** Phase 2 (types) | **Parallel with:** Phase 4 (Backend API)

## Summary

Build all the main user-facing pages with proper layouts, empty states, and navigation. Pages should render beautifully even with no data — this is what potential donors and contributors see first. Includes search with content-type-specific browse views, document viewer with AI summaries, entity pages, datasets, about, login, and discovery features. The goal is to make evidence consumption as intuitive as possible — every document should feel like it's building toward accountability.

## IMPORTANT: No API Routes Yet

Phase 3 runs in parallel with Phase 4 (Backend API). All pages MUST render with empty states and mock data. Use this pattern:

```typescript
// For server components that will eventually fetch from Supabase:
// Return empty/mock data with proper types
const data: SomeType[] = [] // Will be replaced with real fetch in Phase 4

// For client components that will eventually call API routes:
// Use React Query with disabled queries or mock data
const { data } = useQuery({
  queryKey: ['search', query],
  queryFn: () => fetch('/api/search').then(r => r.json()),
  enabled: false, // Disabled until API routes exist
})
```

---

## Step-by-Step Execution

### Step 1: Install additional shadcn/ui components

```bash
# These are needed by Phase 3 pages
npx shadcn@latest add tabs
npx shadcn@latest add select
npx shadcn@latest add separator
npx shadcn@latest add avatar
npx shadcn@latest add tooltip
npx shadcn@latest add scroll-area
npx shadcn@latest add slider
npx shadcn@latest add table
npx shadcn@latest add progress
npx shadcn@latest add accordion
npx shadcn@latest add popover
npx shadcn@latest add calendar
npx shadcn@latest add command
npx shadcn@latest add checkbox
npx shadcn@latest add label
npx shadcn@latest add textarea
npx shadcn@latest add dropdown-menu
npx shadcn@latest add aspect-ratio
npx shadcn@latest add toggle
npx shadcn@latest add toggle-group
```

Answer "yes" to all prompts. All components go into `components/ui/`.

### Step 2: Create route group layouts

File: `app/(public)/layout.tsx`

```tsx
// app/(public)/layout.tsx
// Public pages — no auth required. Just pass through children.
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
```

File: `app/(auth)/layout.tsx`

```tsx
// app/(auth)/layout.tsx
// Auth-required pages. For now, just pass through.
// Phase 4 will add auth check + redirect to /login.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
```

File: `app/(researcher)/layout.tsx`

```tsx
// app/(researcher)/layout.tsx
// Researcher tier pages. Placeholder for Phase 8.
export default function ResearcherLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
```

### Step 3: Create component directories

```bash
mkdir -p components/search
mkdir -p components/document
mkdir -p components/entity
mkdir -p components/browse
mkdir -p components/discovery
```

### Step 4: Build pages — Session 1 (Home, Search, Document, Entities)

#### Home Page — `app/page.tsx`

Replace the Phase 1 placeholder. This is a server component.

```tsx
// app/page.tsx
import Link from 'next/link'
import { SearchBar } from '@/components/search/SearchBar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

const SAMPLE_SEARCHES = [
  'flight logs passenger list',
  'Palm Beach police report',
  'financial transactions 2003',
  'deposition testimony Maxwell',
  'Little St. James island',
  'FBI interview summary',
]

export default function HomePage() {
  // Will fetch from corpus_stats in Phase 4
  const stats = {
    documents: 0,
    entities: 0,
    redactions_solved: 0,
  }

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
        <h1 className="mb-4 max-w-4xl text-4xl font-bold tracking-tight text-primary sm:text-5xl md:text-6xl">
          3.5 Million Pages of Truth.{' '}
          <span className="text-accent">Now Searchable.</span>
        </h1>
        <p className="mb-8 max-w-2xl text-lg text-muted-foreground">
          AI-powered search across the complete Epstein files released by the U.S. Department of Justice.
          Help uncover the truth through crowdsourced research.
        </p>
        <div className="w-full max-w-2xl">
          <SearchBar />
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {SAMPLE_SEARCHES.map((query) => (
            <Link key={query} href={`/search?q=${encodeURIComponent(query)}`}>
              <Badge variant="secondary" className="cursor-pointer hover:bg-surface-elevated">
                {query}
              </Badge>
            </Link>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="mb-12 text-center text-3xl font-bold">How It Works</h2>
        <div className="grid gap-8 md:grid-cols-3">
          {[
            { icon: '🔍', title: 'Search', desc: 'AI-powered semantic search across documents, images, audio, and video transcripts with full citations.' },
            { icon: '🔗', title: 'Discover', desc: 'Entity relationship mapping, timelines, and geographic evidence reveal hidden connections across the corpus.' },
            { icon: '🔓', title: 'Unredact', desc: 'Crowdsourced redaction solving with cascade matching — one discovery can unlock dozens more.' },
          ].map(({ icon, title, desc }) => (
            <Card key={title} className="border-border bg-surface">
              <CardContent className="pt-6 text-center">
                <div className="mb-4 text-4xl">{icon}</div>
                <h3 className="mb-2 text-xl font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Stats Ticker */}
      <section className="border-y border-border bg-surface py-12">
        <div className="mx-auto grid max-w-4xl gap-8 px-4 text-center md:grid-cols-3">
          {[
            { label: 'Documents Processed', value: stats.documents.toLocaleString() },
            { label: 'Entities Identified', value: stats.entities.toLocaleString() },
            { label: 'Redactions Solved', value: stats.redactions_solved.toLocaleString() },
          ].map(({ label, value }) => (
            <div key={label}>
              <div className="text-3xl font-bold text-accent">{value}</div>
              <div className="mt-1 text-sm text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Funding CTA */}
      <section className="mx-auto max-w-4xl px-4 py-16 text-center">
        <h2 className="mb-4 text-2xl font-bold">Help Process the Evidence</h2>
        <p className="mb-6 text-muted-foreground">
          Every dollar goes directly to processing. Your $5 makes 2,400 pages searchable.
        </p>
        <div className="flex justify-center gap-4">
          <Link href="/funding">
            <Button size="lg">See Your Impact</Button>
          </Link>
          <a href={process.env.NEXT_PUBLIC_GOFUNDME_URL || '#'} target="_blank" rel="noopener noreferrer">
            <Button size="lg" variant="outline">Donate Now</Button>
          </a>
        </div>
      </section>
    </div>
  )
}
```

#### Search Page — `app/(public)/search/page.tsx`

Client component with URL search params.

```tsx
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
```

#### Document Viewer — `app/(public)/document/[id]/page.tsx`

Server component that fetches document data.

```tsx
// app/(public)/document/[id]/page.tsx
import { notFound } from 'next/navigation'
import { DocumentViewer } from '@/components/document/DocumentViewer'
import { DocumentSummary } from '@/components/document/DocumentSummary'
import { DocumentMetadata } from '@/components/document/DocumentMetadata'
import { DocumentCompleteness } from '@/components/document/DocumentCompleteness'
import { RedactionHighlight } from '@/components/document/RedactionHighlight'
import { ChunkNavigator } from '@/components/document/ChunkNavigator'
import { RelatedDocuments } from '@/components/document/RelatedDocuments'
import { ContentWarning } from '@/components/document/ContentWarning'
import { EmptyState } from '@/components/shared/EmptyState'

interface DocumentPageProps {
  params: Promise<{ id: string }>
}

export default async function DocumentPage({ params }: DocumentPageProps) {
  const { id } = await params

  // Will fetch from Supabase in Phase 4. For now, return null to show empty state.
  const document = null as null | {
    id: string
    filename: string
    classification: string | null
    dataset_name: string | null
    page_count: number | null
    date_extracted: string | null
    ocr_text: string | null
    is_redacted: boolean
    metadata: Record<string, unknown>
    chunks: Array<{ id: string; content: string; page_number: number | null; contextual_header: string | null }>
    redactions: Array<{ id: string; status: string; page_number: number | null; surrounding_text: string }>
  }

  if (!document) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <EmptyState
          variant="not-processed"
          title="Document Not Yet Available"
          description="This document hasn't been processed yet, or the ID is invalid. Documents become searchable as they are funded and processed."
          showFundingCTA
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 px-4 py-6 lg:flex-row lg:px-8">
      {/* Main Content */}
      <div className="flex-1 space-y-6">
        <ContentWarning />
        <DocumentSummary document={document} />
        <DocumentViewer chunks={document.chunks} />
      </div>

      {/* Sidebar */}
      <aside className="w-full space-y-6 lg:w-80">
        <DocumentMetadata document={document} />
        <DocumentCompleteness documentId={id} />
        <ChunkNavigator chunks={document.chunks} />
        <RelatedDocuments documentId={id} />
      </aside>
    </div>
  )
}
```

#### Entity Profile — `app/(public)/entity/[id]/page.tsx`

```tsx
// app/(public)/entity/[id]/page.tsx
import { notFound } from 'next/navigation'
import { EntityProfile } from '@/components/entity/EntityProfile'
import { EmptyState } from '@/components/shared/EmptyState'

interface EntityPageProps {
  params: Promise<{ id: string }>
}

export default async function EntityPage({ params }: EntityPageProps) {
  const { id } = await params

  // Will fetch from Supabase in Phase 4
  const entity = null as null | {
    id: string
    name: string
    entity_type: string
    aliases: string[]
    description: string | null
    mention_count: number
    document_count: number
    first_seen_date: string | null
    last_seen_date: string | null
    is_verified: boolean
    metadata: Record<string, unknown>
  }

  if (!entity) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <EmptyState
          variant="not-processed"
          title="Entity Not Found"
          description="This entity hasn't been extracted yet, or the ID is invalid."
          showFundingCTA
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
      <EntityProfile entity={entity} />
    </div>
  )
}
```

#### Entity Directory — `app/(public)/entities/page.tsx`

```tsx
// app/(public)/entities/page.tsx
'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { EntityCard } from '@/components/entity/EntityCard'
import { EmptyState } from '@/components/shared/EmptyState'
import type { EntityType } from '@/types/entities'

export default function EntitiesPage() {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | EntityType>('all')

  // Will fetch from API in Phase 4
  const entities: Array<{
    id: string
    name: string
    entity_type: EntityType
    mention_count: number
    document_count: number
  }> = []

  const filtered = entities.filter((e) => {
    if (typeFilter !== 'all' && e.entity_type !== typeFilter) return false
    if (search && !e.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
      <h1 className="mb-6 text-3xl font-bold">Entities</h1>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row">
        <Input
          placeholder="Search entities..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <Tabs value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="person">People</TabsTrigger>
          <TabsTrigger value="organization">Organizations</TabsTrigger>
          <TabsTrigger value="location">Locations</TabsTrigger>
        </TabsList>

        <TabsContent value={typeFilter} className="mt-6">
          {filtered.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((entity) => (
                <EntityCard key={entity.id} entity={entity} />
              ))}
            </div>
          ) : (
            <EmptyState
              variant="not-processed"
              title="No Entities Yet"
              description="Entities are extracted automatically as documents are processed. Help fund processing to discover the people, organizations, and locations in the files."
              showFundingCTA
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

#### Photos Page — `app/(public)/photos/page.tsx`

```tsx
// app/(public)/photos/page.tsx
'use client'

import { PhotoGallery } from '@/components/browse/PhotoGallery'
import { EmptyState } from '@/components/shared/EmptyState'

export default function PhotosPage() {
  // Will fetch from API in Phase 4
  const images: Array<{
    id: string
    storage_path: string
    filename: string | null
    description: string | null
    page_number: number | null
    document_id: string | null
    is_redacted: boolean
  }> = []

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
      <h1 className="mb-6 text-3xl font-bold">Photo Gallery</h1>
      {images.length > 0 ? (
        <PhotoGallery images={images} />
      ) : (
        <EmptyState
          variant="not-processed"
          title="Photo Gallery"
          description="Photos will appear here as documents are processed. The archive contains thousands of images including surveillance photos, party photos, property images, and more."
          showFundingCTA
        />
      )}
    </div>
  )
}
```

#### Audio Page — `app/(public)/audio/page.tsx`

```tsx
// app/(public)/audio/page.tsx
'use client'

import { AudioPlaylist } from '@/components/browse/AudioPlaylist'
import { AudioPlayer } from '@/components/browse/AudioPlayer'
import { EmptyState } from '@/components/shared/EmptyState'

export default function AudioPage() {
  // Will fetch from API in Phase 4
  const audioFiles: Array<{
    id: string
    filename: string
    duration_seconds: number | null
    transcript: string | null
    dataset_name: string | null
  }> = []

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
      <h1 className="mb-6 text-3xl font-bold">Audio Archive</h1>
      <p className="mb-8 text-muted-foreground">
        Court recordings, depositions, and other audio from the Epstein files.
        Each recording includes a searchable AI-generated transcript.
      </p>
      {audioFiles.length > 0 ? (
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="flex-1">
            <AudioPlaylist files={audioFiles} />
          </div>
          <div className="lg:w-96">
            <AudioPlayer />
          </div>
        </div>
      ) : (
        <EmptyState
          variant="not-processed"
          title="Audio Archive"
          description="Audio files will appear here as they are transcribed and processed. This includes court recordings, depositions, and other audio evidence."
          showFundingCTA
        />
      )}
    </div>
  )
}
```

#### Flights Page — `app/(public)/flights/page.tsx`

```tsx
// app/(public)/flights/page.tsx
'use client'

import { FlightLogTable } from '@/components/browse/FlightLogTable'
import { FlightLogFilters } from '@/components/browse/FlightLogFilters'
import { EmptyState } from '@/components/shared/EmptyState'

export default function FlightsPage() {
  // Will come from structured_data_extractions where extraction_type = 'flight_manifest'
  const flights: Array<{
    id: string
    date: string | null
    aircraft: string | null
    origin: string | null
    destination: string | null
    passengers: string[]
    document_id: string
    page_number: number | null
  }> = []

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
      <h1 className="mb-2 text-3xl font-bold">Flight Log Explorer</h1>
      <p className="mb-6 text-muted-foreground">
        Structured flight manifest data extracted from the Epstein files.
        Filter by passenger, date, aircraft, or route.
      </p>
      {flights.length > 0 ? (
        <>
          <FlightLogFilters />
          <FlightLogTable flights={flights} />
        </>
      ) : (
        <EmptyState
          variant="not-processed"
          title="Flight Log Explorer"
          description="Flight manifest data will appear here once the flight log documents are processed and structured data is extracted. Known logs include records from aircraft N908JE and others."
          showFundingCTA
        />
      )}
    </div>
  )
}
```

#### Datasets Page — `app/(public)/datasets/page.tsx`

```tsx
// app/(public)/datasets/page.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'

const DATASETS = [
  { number: 1, name: 'Dataset 1: Initial Release', description: 'First batch of DOJ documents' },
  { number: 2, name: 'Dataset 2: Court Filings', description: 'Civil and criminal court documents' },
  { number: 3, name: 'Dataset 3: FBI Reports', description: 'FBI 302 interview reports and summaries' },
  { number: 4, name: 'Dataset 4: Flight Logs', description: 'Aircraft flight manifests and records' },
  { number: 5, name: 'Dataset 5: Financial Records', description: 'Banking and financial documents' },
  { number: 6, name: 'Dataset 6: Correspondence', description: 'Letters, emails, and messages' },
  { number: 7, name: 'Dataset 7: Property Records', description: 'Real estate and property documents' },
  { number: 8, name: 'Dataset 8: Depositions', description: 'Sworn testimony transcripts' },
  { number: 9, name: 'Dataset 9: Photographs', description: 'Photos and images from evidence' },
  { number: 10, name: 'Dataset 10: Police Reports', description: 'Law enforcement reports and investigations' },
  { number: 11, name: 'Dataset 11: Estate Documents', description: 'Estate and trust documents' },
  { number: 12, name: 'Dataset 12: Miscellaneous', description: 'Additional documents and evidence' },
]

export default function DatasetsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
      <h1 className="mb-2 text-3xl font-bold">DOJ Datasets</h1>
      <p className="mb-8 text-muted-foreground">
        The U.S. Department of Justice released the Epstein files across 12 datasets.
        Each dataset is being processed for AI-powered search, entity extraction, and redaction analysis.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        {DATASETS.map((ds) => (
          <Card key={ds.number} className="border-border bg-surface">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{ds.name}</CardTitle>
                <Badge variant="outline">Pending</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-sm text-muted-foreground">{ds.description}</p>
              <div className="mb-2 flex justify-between text-xs text-muted-foreground">
                <span>0 documents</span>
                <span>0%</span>
              </div>
              <Progress value={0} className="h-2" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
```

#### Discoveries Page — `app/(public)/discoveries/page.tsx`

```tsx
// app/(public)/discoveries/page.tsx
'use client'

import { DiscoveryFeed } from '@/components/discovery/DiscoveryFeed'
import { ThisDayInFiles } from '@/components/discovery/ThisDayInFiles'
import { EmptyState } from '@/components/shared/EmptyState'

export default function DiscoveriesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
      <h1 className="mb-2 text-3xl font-bold">Discoveries</h1>
      <p className="mb-8 text-muted-foreground">
        A live feed of confirmed redaction solves, new entity connections,
        and pattern discoveries from the community.
      </p>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-4 text-xl font-semibold">Recent Discoveries</h2>
          <DiscoveryFeed />
        </div>
        <div>
          <ThisDayInFiles />
        </div>
      </div>
    </div>
  )
}
```

#### About Page — `app/(public)/about/page.tsx`

```tsx
// app/(public)/about/page.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 lg:px-8">
      <h1 className="mb-4 text-3xl font-bold">About The Epstein Archive</h1>

      <section className="mb-12">
        <p className="mb-4 text-lg text-muted-foreground">
          The Epstein Archive is an open-source platform for searching, analyzing,
          and connecting the 3.5 million pages of documents released by the U.S. Department
          of Justice related to Jeffrey Epstein. Our mission is to make this evidence
          accessible, searchable, and actionable.
        </p>
      </section>

      <Separator className="my-8" />

      {/* For Prosecutors */}
      <section className="mb-12">
        <h2 className="mb-4 text-2xl font-bold text-accent">For Prosecutors</h2>
        <p className="mb-4 text-muted-foreground">
          This platform is designed to do the heavy lifting of evidence discovery so that
          prosecutors can focus on legal strategy. Every feature moves toward one goal:
          identifying crimes, identifying perpetrators, and preparing the evidence for action.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {[
            { title: 'Entity Dossiers', desc: 'Auto-compiled evidence summaries for every person, with full document citations.' },
            { title: 'Criminal Indicators', desc: 'AI-scored patterns suggesting trafficking, obstruction, conspiracy, and financial crimes.' },
            { title: 'Evidence Chains', desc: 'Full source provenance for every data point — built for admissibility.' },
            { title: 'Exportable Packages', desc: 'Download evidence packages in legal-ready formats (PDF, BibTeX, JSON).' },
          ].map(({ title, desc }) => (
            <Card key={title} className="border-border bg-surface">
              <CardContent className="pt-6">
                <h3 className="mb-2 font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Separator className="my-8" />

      {/* Methodology */}
      <section className="mb-12">
        <h2 className="mb-4 text-2xl font-bold">Methodology</h2>
        <div className="space-y-4 text-muted-foreground">
          <p><strong className="text-primary">OCR:</strong> Google Cloud Document AI extracts text with structure preservation.</p>
          <p><strong className="text-primary">Embeddings:</strong> Google Vertex AI generates 768-dimensional text embeddings and 1408-dimensional image embeddings for semantic search.</p>
          <p><strong className="text-primary">Search:</strong> Hybrid search combining vector similarity (semantic) with BM25 keyword search via Reciprocal Rank Fusion.</p>
          <p><strong className="text-primary">Entities:</strong> AI-powered extraction of people, organizations, locations, and relationships with cross-document deduplication.</p>
          <p><strong className="text-primary">Redactions:</strong> Automated detection and cataloging of redacted regions with context analysis for crowdsourced solving.</p>
        </div>
      </section>

      <Separator className="my-8" />

      {/* FAQ */}
      <section className="mb-12">
        <h2 className="mb-4 text-2xl font-bold">FAQ</h2>
        <Accordion type="single" collapsible>
          <AccordionItem value="source">
            <AccordionTrigger>Where do these documents come from?</AccordionTrigger>
            <AccordionContent>All documents come directly from the U.S. Department of Justice public release related to Jeffrey Epstein. No documents are modified — only analyzed and indexed.</AccordionContent>
          </AccordionItem>
          <AccordionItem value="accuracy">
            <AccordionTrigger>How accurate is the AI analysis?</AccordionTrigger>
            <AccordionContent>All AI-generated content (summaries, entity extraction, classifications) is labeled as such. Every data point links back to its source document and page number. Community verification adds an additional layer of accuracy.</AccordionContent>
          </AccordionItem>
          <AccordionItem value="contribute">
            <AccordionTrigger>How can I contribute?</AccordionTrigger>
            <AccordionContent>You can submit redaction proposals, match images, provide intelligence hints, correct OCR errors, annotate documents, and participate in investigation threads. Sign in to get started.</AccordionContent>
          </AccordionItem>
          <AccordionItem value="funding">
            <AccordionTrigger>Where does the money go?</AccordionTrigger>
            <AccordionContent>100% of donations go to document processing costs (OCR, AI analysis, hosting). Every dollar spent is logged publicly on the funding page with full transparency.</AccordionContent>
          </AccordionItem>
          <AccordionItem value="opensource">
            <AccordionTrigger>Is this open source?</AccordionTrigger>
            <AccordionContent>Yes. The entire platform is MIT licensed and available on GitHub. We welcome contributions from developers, researchers, and journalists.</AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>

      {/* Media Kit */}
      <section>
        <h2 className="mb-4 text-2xl font-bold">Media & Citations</h2>
        <p className="text-muted-foreground">
          When citing findings from this platform, please reference the original DOJ document
          (dataset number, filename, page number) as well as The Epstein Archive as the discovery tool.
          For press inquiries, contact us via our GitHub repository.
        </p>
      </section>
    </div>
  )
}
```

#### Login Page — `app/login/page.tsx`

```tsx
// app/login/page.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    // Phase 4: Supabase auth
  }

  const handleOAuthLogin = async (provider: 'google' | 'github') => {
    // Phase 4: Supabase OAuth
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
      <Card className="w-full max-w-md border-border bg-surface">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Sign In</CardTitle>
          <CardDescription>
            Join the investigation. Contribute, save searches, and earn recognition.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* OAuth */}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => handleOAuthLogin('google')}
          >
            Continue with Google
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => handleOAuthLogin('github')}
          >
            Continue with GitHub
          </Button>

          <div className="relative my-4">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-surface px-2 text-xs text-muted-foreground">
              or
            </span>
          </div>

          {/* Email/Password */}
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <Button type="submit" className="w-full">
              Sign In
            </Button>
          </form>

          {/* Why sign in */}
          <div className="mt-6 rounded-lg border border-border bg-surface-elevated p-4">
            <h3 className="mb-2 text-sm font-semibold">Why sign in?</h3>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>Submit redaction proposals and intelligence hints</li>
              <li>Save searches and bookmark documents</li>
              <li>Create investigation threads</li>
              <li>Earn XP and achievements for contributions</li>
              <li>Track your impact on the investigation</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

### Step 5: Build loading & error states

```tsx
// app/(public)/search/loading.tsx
import { LoadingState } from '@/components/shared/LoadingState'
export default function SearchLoading() {
  return <LoadingState variant="page" />
}
```

```tsx
// app/(public)/document/[id]/loading.tsx
import { LoadingState } from '@/components/shared/LoadingState'
export default function DocumentLoading() {
  return <LoadingState variant="page" />
}
```

```tsx
// app/(public)/document/[id]/not-found.tsx
import { EmptyState } from '@/components/shared/EmptyState'
export default function DocumentNotFound() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <EmptyState variant="no-results" title="Document Not Found" description="This document doesn't exist or has been removed." />
    </div>
  )
}
```

```tsx
// app/(public)/entity/[id]/loading.tsx
import { LoadingState } from '@/components/shared/LoadingState'
export default function EntityLoading() {
  return <LoadingState variant="page" />
}
```

```tsx
// app/(public)/entity/[id]/not-found.tsx
import { EmptyState } from '@/components/shared/EmptyState'
export default function EntityNotFound() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <EmptyState variant="no-results" title="Entity Not Found" description="This entity doesn't exist in the database." />
    </div>
  )
}
```

```tsx
// app/(public)/entities/loading.tsx
import { LoadingState } from '@/components/shared/LoadingState'
export default function EntitiesLoading() {
  return <LoadingState variant="page" />
}
```

### Step 6: Build hooks

#### `lib/hooks/useSearch.ts`

```typescript
// lib/hooks/useSearch.ts
'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useMemo } from 'react'
import type { SearchFilters, SearchResponse, SearchTab } from '@/types/search'

export function useSearch() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const query = searchParams.get('q') || ''
  const tab = (searchParams.get('tab') as SearchTab) || 'all'
  const page = parseInt(searchParams.get('page') || '1', 10)

  const filters: SearchFilters = useMemo(() => ({
    dataset_id: searchParams.get('dataset') || undefined,
    doc_type: searchParams.get('type') || undefined,
    date_from: searchParams.get('from') || undefined,
    date_to: searchParams.get('to') || undefined,
    entity_id: searchParams.get('entity') || undefined,
    has_redactions: searchParams.get('redacted') === 'true' ? true : undefined,
    tab,
  }), [searchParams, tab])

  const { data, isLoading, error } = useQuery<SearchResponse>({
    queryKey: ['search', query, filters, page],
    queryFn: async () => {
      const params = new URLSearchParams({ q: query, page: String(page), ...filters })
      const res = await fetch(`/api/search?${params}`)
      if (!res.ok) throw new Error('Search failed')
      return res.json()
    },
    enabled: query.length > 0,
    staleTime: 30_000,
  })

  const setQuery = useCallback((newQuery: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('q', newQuery)
    params.set('page', '1')
    router.push(`/search?${params}`)
  }, [router, searchParams])

  const setTab = useCallback((newTab: SearchTab) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', newTab)
    params.set('page', '1')
    router.push(`/search?${params}`)
  }, [router, searchParams])

  const setFilter = useCallback((key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    params.set('page', '1')
    router.push(`/search?${params}`)
  }, [router, searchParams])

  return {
    query,
    tab,
    page,
    filters,
    results: data?.results ?? [],
    totalCount: data?.total_count ?? 0,
    isLoading,
    error,
    setQuery,
    setTab,
    setFilter,
  }
}
```

#### `lib/hooks/useEntity.ts`

```typescript
// lib/hooks/useEntity.ts
'use client'

import { useQuery } from '@tanstack/react-query'
import type { Entity, EntityMention, EntityConnectionNode } from '@/types/entities'

export function useEntity(entityId: string) {
  const { data: entity, isLoading } = useQuery<Entity>({
    queryKey: ['entity', entityId],
    queryFn: async () => {
      const res = await fetch(`/api/entity/${entityId}`)
      if (!res.ok) throw new Error('Entity fetch failed')
      return res.json()
    },
    enabled: !!entityId,
  })

  const { data: mentions } = useQuery<EntityMention[]>({
    queryKey: ['entity', entityId, 'mentions'],
    queryFn: async () => {
      const res = await fetch(`/api/entity/${entityId}?include=mentions`)
      if (!res.ok) throw new Error('Mentions fetch failed')
      return res.json()
    },
    enabled: !!entityId,
  })

  const { data: connections } = useQuery<EntityConnectionNode[]>({
    queryKey: ['entity', entityId, 'connections'],
    queryFn: async () => {
      const res = await fetch(`/api/entity/${entityId}/connections`)
      if (!res.ok) throw new Error('Connections fetch failed')
      return res.json()
    },
    enabled: !!entityId,
  })

  return {
    entity: entity ?? null,
    mentions: mentions ?? [],
    connections: connections ?? [],
    isLoading,
  }
}
```

#### `lib/hooks/useRandomDocument.ts`

```typescript
// lib/hooks/useRandomDocument.ts
'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'

export function useRandomDocument() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const goToRandom = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/document/random')
      if (!res.ok) throw new Error('Failed to get random document')
      const { id } = await res.json()
      router.push(`/document/${id}`)
    } catch {
      // Fallback: show alert if API doesn't exist yet
      alert('Random document feature requires document processing. Check back after funding!')
    } finally {
      setIsLoading(false)
    }
  }, [router])

  return { goToRandom, isLoading }
}
```

#### `lib/hooks/useDiscoveries.ts`

```typescript
// lib/hooks/useDiscoveries.ts
'use client'

import { useQuery } from '@tanstack/react-query'

interface Discovery {
  id: string
  type: 'redaction_solved' | 'entity_connection' | 'pattern_found'
  title: string
  description: string
  user_display_name: string | null
  cascade_count: number
  created_at: string
}

export function useDiscoveries() {
  const { data, isLoading } = useQuery<Discovery[]>({
    queryKey: ['discoveries'],
    queryFn: async () => {
      const res = await fetch('/api/discoveries')
      if (!res.ok) throw new Error('Failed to fetch discoveries')
      return res.json()
    },
    staleTime: 60_000,
  })

  return {
    discoveries: data ?? [],
    isLoading,
  }
}

export function useTodayInHistory() {
  const { data, isLoading } = useQuery({
    queryKey: ['today-in-history'],
    queryFn: async () => {
      const res = await fetch('/api/discoveries/today-in-history')
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
    staleTime: 3600_000, // 1 hour
  })

  return {
    documents: data?.documents ?? [],
    isLoading,
  }
}
```

#### `lib/hooks/useAudio.ts`

```typescript
// lib/hooks/useAudio.ts
'use client'

import { useState, useCallback, useRef } from 'react'

interface AudioTrack {
  id: string
  filename: string
  storage_path: string
  duration_seconds: number | null
  transcript: string | null
}

export function useAudio() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [currentTrack, setCurrentTrack] = useState<AudioTrack | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  const play = useCallback((track: AudioTrack) => {
    setCurrentTrack(track)
    setIsPlaying(true)
    // Audio element will be controlled by AudioPlayer component
  }, [])

  const pause = useCallback(() => {
    setIsPlaying(false)
  }, [])

  const seek = useCallback((time: number) => {
    setCurrentTime(time)
    if (audioRef.current) {
      audioRef.current.currentTime = time
    }
  }, [])

  return {
    audioRef,
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    play,
    pause,
    seek,
    setCurrentTime,
    setDuration,
  }
}
```

### Step 7: Build components — Session 2

Each component below shows the exact file content. Components are listed with their full code.

#### `components/search/SearchBar.tsx`

```tsx
// components/search/SearchBar.tsx
'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useRandomDocument } from '@/lib/hooks/useRandomDocument'

interface SearchBarProps {
  defaultValue?: string
}

export function SearchBar({ defaultValue = '' }: SearchBarProps) {
  const router = useRouter()
  const [query, setQuery] = useState(defaultValue)
  const { goToRandom, isLoading: randomLoading } = useRandomDocument()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full gap-2">
      <div className="relative flex-1">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search documents, entities, images, audio..."
          className="h-12 border-border bg-surface pl-4 pr-10 text-lg focus:ring-2 focus:ring-accent/20"
        />
        <kbd className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-surface-elevated px-1.5 py-0.5 text-xs text-muted-foreground sm:inline">
          ⌘K
        </kbd>
      </div>
      <Button type="submit" size="lg" className="h-12 px-6">
        Search
      </Button>
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="h-12"
        onClick={goToRandom}
        disabled={randomLoading}
        title="Random Document"
      >
        🎲
      </Button>
    </form>
  )
}
```

#### `components/search/SearchResults.tsx`

```tsx
// components/search/SearchResults.tsx
'use client'

import { ResultCard } from './ResultCard'
import { ImageResult } from './ImageResult'
import { AudioResult } from './AudioResult'
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
```

#### `components/search/SearchFilters.tsx`

```tsx
// components/search/SearchFilters.tsx
'use client'

import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

export function SearchFilters() {
  return (
    <div className="space-y-6 p-4">
      <h3 className="text-sm font-semibold">Filters</h3>

      {/* Dataset Filter */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Dataset</Label>
        <Select>
          <SelectTrigger><SelectValue placeholder="All datasets" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All datasets</SelectItem>
            {Array.from({ length: 12 }, (_, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>Dataset {i + 1}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Document Type Filter */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Document Type</Label>
        <Select>
          <SelectTrigger><SelectValue placeholder="All types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="deposition">Deposition</SelectItem>
            <SelectItem value="flight_log">Flight Log</SelectItem>
            <SelectItem value="fbi_302">FBI 302</SelectItem>
            <SelectItem value="financial">Financial</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="court_filing">Court Filing</SelectItem>
            <SelectItem value="police_report">Police Report</SelectItem>
            <SelectItem value="correspondence">Correspondence</SelectItem>
            <SelectItem value="photo">Photo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {/* Redaction filter */}
      <div className="flex items-center gap-2">
        <Checkbox id="has-redactions" />
        <Label htmlFor="has-redactions" className="text-sm">Has redactions</Label>
      </div>

      <Button variant="outline" size="sm" className="w-full">
        Clear Filters
      </Button>
    </div>
  )
}
```

#### `components/search/ResultCard.tsx`

```tsx
// components/search/ResultCard.tsx
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface ResultCardProps {
  chunkId: string
  documentId: string
  content: string
  contextualHeader: string | null
  pageNumber: number | null
  documentFilename: string
  documentClassification: string | null
  datasetName: string | null
  rrfScore: number
}

export function ResultCard({
  documentId,
  content,
  contextualHeader,
  pageNumber,
  documentFilename,
  documentClassification,
  datasetName,
}: ResultCardProps) {
  return (
    <Link href={`/document/${documentId}${pageNumber ? `#page-${pageNumber}` : ''}`}>
      <Card className="border-border bg-surface transition-colors hover:bg-surface-elevated">
        <CardContent className="pt-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-sm font-medium text-primary">{documentFilename}</span>
            {pageNumber && (
              <span className="text-xs text-muted-foreground">p. {pageNumber}</span>
            )}
          </div>
          {contextualHeader && (
            <p className="mb-1 text-xs text-muted-foreground">{contextualHeader}</p>
          )}
          <p className="line-clamp-3 text-sm text-muted-foreground">{content}</p>
          <div className="mt-3 flex gap-2">
            {documentClassification && (
              <Badge variant="outline" className="text-xs">{documentClassification}</Badge>
            )}
            {datasetName && (
              <Badge variant="secondary" className="text-xs">{datasetName}</Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
```

#### `components/search/ImageResult.tsx`

```tsx
// components/search/ImageResult.tsx
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface ImageResultProps {
  id: string
  storagePath: string | null
  description: string | null
  filename: string | null
  datasetName: string | null
  documentId: string | null
}

export function ImageResult({ description, filename, datasetName }: ImageResultProps) {
  return (
    <Card className="border-border bg-surface">
      <CardContent className="pt-4">
        <div className="mb-2 aspect-video rounded bg-surface-elevated" />
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {description || filename || 'Image'}
        </p>
        {datasetName && <Badge variant="secondary" className="mt-2 text-xs">{datasetName}</Badge>}
      </CardContent>
    </Card>
  )
}
```

#### `components/search/VideoResult.tsx`

```tsx
// components/search/VideoResult.tsx
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface VideoResultProps {
  id: string
  content: string
  filename: string | null
  datasetName: string | null
  timestampStart?: number
  timestampEnd?: number
}

export function VideoResult({ content, filename, datasetName }: VideoResultProps) {
  return (
    <Card className="border-border bg-surface">
      <CardContent className="pt-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-sm font-medium text-primary">{filename || 'Video'}</span>
        </div>
        <p className="line-clamp-3 font-mono text-sm text-muted-foreground">{content}</p>
        {datasetName && <Badge variant="secondary" className="mt-2 text-xs">{datasetName}</Badge>}
      </CardContent>
    </Card>
  )
}
```

#### `components/search/AudioResult.tsx`

```tsx
// components/search/AudioResult.tsx
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface AudioResultProps {
  id: string
  content: string
  filename: string | null
  datasetName: string | null
  timestampStart?: number
  timestampEnd?: number
  speakerLabel?: string
}

export function AudioResult({ content, filename, datasetName, speakerLabel }: AudioResultProps) {
  const formatTime = (seconds?: number) => {
    if (!seconds) return ''
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <Card className="border-border bg-surface">
      <CardContent className="pt-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-sm">🎧</span>
          <span className="text-sm font-medium text-primary">{filename || 'Audio'}</span>
          {speakerLabel && <Badge variant="outline" className="text-xs">{speakerLabel}</Badge>}
        </div>
        <p className="line-clamp-3 font-mono text-sm text-muted-foreground">{content}</p>
        {datasetName && <Badge variant="secondary" className="mt-2 text-xs">{datasetName}</Badge>}
      </CardContent>
    </Card>
  )
}
```

#### Document Components

Create each file below in `components/document/`:

```tsx
// components/document/DocumentViewer.tsx
'use client'

import { ScrollArea } from '@/components/ui/scroll-area'

interface Chunk {
  id: string
  content: string
  page_number: number | null
  contextual_header: string | null
}

interface DocumentViewerProps {
  chunks: Chunk[]
}

export function DocumentViewer({ chunks }: DocumentViewerProps) {
  if (chunks.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-[#1e1e2e] p-6 text-center text-muted-foreground">
        No content available yet.
      </div>
    )
  }

  return (
    <ScrollArea className="h-[70vh] rounded-lg border border-border bg-[#1e1e2e]">
      <div className="p-6">
        {chunks.map((chunk, i) => (
          <div key={chunk.id} id={`chunk-${i}`} className="mb-6">
            {chunk.page_number && (
              <div id={`page-${chunk.page_number}`} className="mb-2 text-xs text-muted-foreground">
                — Page {chunk.page_number} —
              </div>
            )}
            {chunk.contextual_header && (
              <div className="mb-1 text-xs italic text-muted-foreground">{chunk.contextual_header}</div>
            )}
            <p className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-primary">
              {chunk.content}
            </p>
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}
```

```tsx
// components/document/DocumentSummary.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface DocumentSummaryProps {
  document: {
    filename: string
    classification: string | null
    metadata: Record<string, unknown>
  }
}

export function DocumentSummary({ document }: DocumentSummaryProps) {
  // AI summary will be populated by worker pipeline in Phase 6
  return (
    <Card className="border-border bg-surface">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Executive Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm italic text-muted-foreground">
          AI-generated summary will appear here once this document is fully processed.
        </p>
      </CardContent>
    </Card>
  )
}
```

```tsx
// components/document/DocumentMetadata.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

interface DocumentMetadataProps {
  document: {
    filename: string
    classification: string | null
    dataset_name: string | null
    page_count: number | null
    date_extracted: string | null
    is_redacted: boolean
  }
}

export function DocumentMetadata({ document }: DocumentMetadataProps) {
  return (
    <Card className="border-border bg-surface">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Document Info</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>
          <span className="text-muted-foreground">Filename:</span>
          <p className="font-mono text-xs">{document.filename}</p>
        </div>
        <Separator />
        {document.classification && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Type:</span>
            <Badge variant="outline">{document.classification}</Badge>
          </div>
        )}
        {document.dataset_name && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Dataset:</span>
            <Badge variant="secondary">{document.dataset_name}</Badge>
          </div>
        )}
        {document.page_count && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Pages:</span>
            <span>{document.page_count}</span>
          </div>
        )}
        {document.date_extracted && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Date:</span>
            <span>{new Date(document.date_extracted).toLocaleDateString()}</span>
          </div>
        )}
        {document.is_redacted && (
          <Badge className="bg-accent/10 text-accent">Contains Redactions</Badge>
        )}
      </CardContent>
    </Card>
  )
}
```

```tsx
// components/document/DocumentCompleteness.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

interface DocumentCompletenessProps {
  documentId: string
}

const REVIEW_TYPES = [
  { id: 'ocr_verified', label: 'OCR text verified' },
  { id: 'entities_confirmed', label: 'Entities confirmed' },
  { id: 'dates_validated', label: 'Dates validated' },
  { id: 'redactions_attempted', label: 'Redactions attempted' },
  { id: 'cross_references_checked', label: 'Cross-references checked' },
]

export function DocumentCompleteness({ documentId }: DocumentCompletenessProps) {
  return (
    <Card className="border-border bg-surface">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Review Checklist</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {REVIEW_TYPES.map((type) => (
          <div key={type.id} className="flex items-center gap-2">
            <Checkbox id={type.id} disabled />
            <Label htmlFor={type.id} className="text-xs text-muted-foreground">{type.label}</Label>
          </div>
        ))}
        <p className="mt-2 text-xs text-muted-foreground">
          Sign in to help review this document.
        </p>
      </CardContent>
    </Card>
  )
}
```

```tsx
// components/document/RedactionHighlight.tsx
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface RedactionHighlightProps {
  status: 'unsolved' | 'proposed' | 'corroborated' | 'confirmed' | 'disputed'
  text: string
  resolvedText?: string | null
  solvedBy?: string | null
}

export function RedactionHighlight({ status, text, resolvedText, solvedBy }: RedactionHighlightProps) {
  const isSolved = status === 'confirmed'

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={
              isSolved
                ? 'border border-solid border-green-500 bg-green-950/20 px-1'
                : 'border border-dashed border-red-600 bg-black px-1'
            }
          >
            {isSolved ? resolvedText || text : '████████'}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {isSolved ? (
            <p>Solved{solvedBy ? ` by @${solvedBy}` : ''}</p>
          ) : (
            <p>Redacted — Help solve this</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
```

```tsx
// components/document/ChunkNavigator.tsx
'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'

interface Chunk {
  id: string
  content: string
  page_number: number | null
  contextual_header: string | null
}

interface ChunkNavigatorProps {
  chunks: Chunk[]
}

export function ChunkNavigator({ chunks }: ChunkNavigatorProps) {
  const scrollToChunk = (index: number) => {
    document.getElementById(`chunk-${index}`)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <Card className="border-border bg-surface">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Sections ({chunks.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-48">
          <div className="space-y-1">
            {chunks.map((chunk, i) => (
              <Button
                key={chunk.id}
                variant="ghost"
                size="sm"
                className="w-full justify-start text-xs"
                onClick={() => scrollToChunk(i)}
              >
                {chunk.page_number && <span className="mr-2 text-muted-foreground">p.{chunk.page_number}</span>}
                <span className="truncate">{chunk.contextual_header || chunk.content.slice(0, 40)}</span>
              </Button>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
```

```tsx
// components/document/RelatedDocuments.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface RelatedDocumentsProps {
  documentId: string
}

export function RelatedDocuments({ documentId }: RelatedDocumentsProps) {
  // Will fetch from /api/document/{id}/similar in Phase 4
  return (
    <Card className="border-border bg-surface">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Related Documents</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">
          Similar documents will appear here once processing is complete.
        </p>
      </CardContent>
    </Card>
  )
}
```

```tsx
// components/document/ContentWarning.tsx
'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

export function ContentWarning() {
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    const pref = localStorage.getItem('content-warning-dismissed')
    setDismissed(pref === 'true')
  }, [])

  if (dismissed) return null

  return (
    <div className="rounded-lg border border-amber-600/30 bg-amber-950/20 p-4">
      <h3 className="mb-2 font-semibold text-amber-400">Content Warning</h3>
      <p className="mb-3 text-sm text-muted-foreground">
        This document may contain descriptions of abuse, exploitation, or other disturbing content.
      </p>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          localStorage.setItem('content-warning-dismissed', 'true')
          setDismissed(true)
        }}
      >
        I understand, continue
      </Button>
    </div>
  )
}
```

#### Entity Components

```tsx
// components/entity/EntityCard.tsx
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { EntityType } from '@/types/entities'

const TYPE_COLORS: Record<EntityType, string> = {
  person: 'text-blue-400 border-blue-400/30',
  organization: 'text-purple-400 border-purple-400/30',
  location: 'text-green-400 border-green-400/30',
  aircraft: 'text-amber-400 border-amber-400/30',
  vessel: 'text-cyan-400 border-cyan-400/30',
  property: 'text-orange-400 border-orange-400/30',
  account: 'text-pink-400 border-pink-400/30',
}

interface EntityCardProps {
  entity: {
    id: string
    name: string
    entity_type: EntityType
    mention_count: number
    document_count: number
  }
}

export function EntityCard({ entity }: EntityCardProps) {
  return (
    <Link href={`/entity/${entity.id}`}>
      <Card className="border-border bg-surface transition-colors hover:bg-surface-elevated">
        <CardContent className="pt-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-semibold">{entity.name}</h3>
            <Badge variant="outline" className={TYPE_COLORS[entity.entity_type]}>
              {entity.entity_type}
            </Badge>
          </div>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>{entity.mention_count} mentions</span>
            <span>{entity.document_count} documents</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
```

```tsx
// components/entity/EntityProfile.tsx
'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { EntityMentions } from './EntityMentions'
import { EntityTimeline } from './EntityTimeline'
import { EntityConnections } from './EntityConnections'
import { EntityDossier } from './EntityDossier'
import type { Entity } from '@/types/entities'

interface EntityProfileProps {
  entity: Entity
}

export function EntityProfile({ entity }: EntityProfileProps) {
  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">{entity.name}</h1>
          <Badge variant="outline">{entity.entity_type}</Badge>
          {entity.is_verified && <Badge className="bg-green-600">Verified</Badge>}
        </div>
        {entity.aliases.length > 0 && (
          <p className="mt-1 text-sm text-muted-foreground">
            Also known as: {entity.aliases.join(', ')}
          </p>
        )}
        <div className="mt-2 flex gap-4 text-sm text-muted-foreground">
          <span>{entity.mention_count} mentions</span>
          <span>{entity.document_count} documents</span>
          {entity.first_seen_date && <span>First seen: {new Date(entity.first_seen_date).toLocaleDateString()}</span>}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="connections">Connections</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="redactions">Redactions</TabsTrigger>
          <TabsTrigger value="dossier">Evidence Dossier</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <p className="text-muted-foreground">
            {entity.description || 'AI-generated summary will appear once this entity is fully analyzed.'}
          </p>
        </TabsContent>

        <TabsContent value="documents" className="mt-6">
          <EntityMentions entityId={entity.id} />
        </TabsContent>

        <TabsContent value="connections" className="mt-6">
          <EntityConnections entityId={entity.id} />
        </TabsContent>

        <TabsContent value="timeline" className="mt-6">
          <EntityTimeline entityId={entity.id} />
        </TabsContent>

        <TabsContent value="redactions" className="mt-6">
          <p className="text-sm text-muted-foreground">
            Redactions where this entity may be the hidden text will appear here.
          </p>
        </TabsContent>

        <TabsContent value="dossier" className="mt-6">
          <EntityDossier entity={entity} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

```tsx
// components/entity/EntityMentions.tsx
import { EmptyState } from '@/components/shared/EmptyState'

interface EntityMentionsProps {
  entityId: string
}

export function EntityMentions({ entityId }: EntityMentionsProps) {
  // Will fetch from API in Phase 4
  return (
    <EmptyState
      variant="not-processed"
      title="Document Mentions"
      description="Document mentions will appear as documents are processed and entities are extracted."
    />
  )
}
```

```tsx
// components/entity/EntityTimeline.tsx
import { EmptyState } from '@/components/shared/EmptyState'

interface EntityTimelineProps {
  entityId: string
}

export function EntityTimeline({ entityId }: EntityTimelineProps) {
  // Will fetch from API in Phase 4
  return (
    <EmptyState
      variant="not-processed"
      title="Entity Timeline"
      description="A chronological timeline of this entity's appearances across the documents."
    />
  )
}
```

```tsx
// components/entity/EntityConnections.tsx
import { EmptyState } from '@/components/shared/EmptyState'

interface EntityConnectionsProps {
  entityId: string
}

export function EntityConnections({ entityId }: EntityConnectionsProps) {
  // Mini relationship graph will be added in Phase 8 (D3 visualization)
  return (
    <EmptyState
      variant="coming-soon"
      title="Entity Connections"
      description="An interactive graph showing this entity's relationships will appear here once the entity graph is built."
    />
  )
}
```

```tsx
// components/entity/EntityDossier.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { Entity } from '@/types/entities'

interface EntityDossierProps {
  entity: Entity
}

export function EntityDossier({ entity }: EntityDossierProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold">Evidence Dossier: {entity.name}</h3>
        <Button variant="outline" size="sm" disabled>
          Export Dossier (PDF)
        </Button>
      </div>

      <Card className="border-border bg-surface">
        <CardHeader><CardTitle className="text-sm">Involvement Summary</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Auto-generated prosecutor-ready summary will appear once sufficient evidence is processed.
          </p>
        </CardContent>
      </Card>

      <Card className="border-border bg-surface">
        <CardHeader><CardTitle className="text-sm">Key Documents</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Documents with strongest evidence connections.</p>
        </CardContent>
      </Card>

      <Card className="border-border bg-surface">
        <CardHeader><CardTitle className="text-sm">Relationship Evidence</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Documented relationships and connections.</p>
        </CardContent>
      </Card>

      <Card className="border-border bg-surface">
        <CardHeader><CardTitle className="text-sm">Timeline of Activities</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Chronological record of documented activities.</p>
        </CardContent>
      </Card>
    </div>
  )
}
```

#### Browse Components

```tsx
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
```

```tsx
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
```

```tsx
// components/browse/AudioPlayer.tsx
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'

export function AudioPlayer() {
  return (
    <Card className="border-border bg-surface">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Now Playing</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">Select a recording to play</p>
        <div className="flex items-center justify-center gap-4">
          <Button variant="ghost" size="sm" disabled>⏮</Button>
          <Button variant="outline" size="sm" disabled>▶</Button>
          <Button variant="ghost" size="sm" disabled>⏭</Button>
        </div>
        <Slider defaultValue={[0]} max={100} step={1} disabled />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>0:00</span>
          <span>0:00</span>
        </div>
      </CardContent>
    </Card>
  )
}
```

```tsx
// components/browse/AudioPlaylist.tsx
import { Card, CardContent } from '@/components/ui/card'

interface AudioFile {
  id: string
  filename: string
  duration_seconds: number | null
  transcript: string | null
  dataset_name: string | null
}

interface AudioPlaylistProps {
  files: AudioFile[]
}

export function AudioPlaylist({ files }: AudioPlaylistProps) {
  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--:--'
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="space-y-2">
      {files.map((file) => (
        <Card key={file.id} className="cursor-pointer border-border bg-surface transition-colors hover:bg-surface-elevated">
          <CardContent className="flex items-center gap-4 py-3">
            <span className="text-lg">🎧</span>
            <div className="flex-1">
              <p className="text-sm font-medium">{file.filename}</p>
              {file.dataset_name && (
                <p className="text-xs text-muted-foreground">{file.dataset_name}</p>
              )}
            </div>
            <span className="text-xs text-muted-foreground">{formatDuration(file.duration_seconds)}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
```

```tsx
// components/browse/FlightLogTable.tsx
'use client'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import Link from 'next/link'

interface Flight {
  id: string
  date: string | null
  aircraft: string | null
  origin: string | null
  destination: string | null
  passengers: string[]
  document_id: string
  page_number: number | null
}

interface FlightLogTableProps {
  flights: Flight[]
}

export function FlightLogTable({ flights }: FlightLogTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Aircraft</TableHead>
            <TableHead>Origin</TableHead>
            <TableHead>Destination</TableHead>
            <TableHead>Passengers</TableHead>
            <TableHead>Source</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {flights.map((flight) => (
            <TableRow key={flight.id}>
              <TableCell className="whitespace-nowrap">{flight.date || '—'}</TableCell>
              <TableCell>{flight.aircraft || '—'}</TableCell>
              <TableCell>{flight.origin || '—'}</TableCell>
              <TableCell>{flight.destination || '—'}</TableCell>
              <TableCell>{flight.passengers.join(', ') || '—'}</TableCell>
              <TableCell>
                <Link
                  href={`/document/${flight.document_id}${flight.page_number ? `#page-${flight.page_number}` : ''}`}
                  className="text-blue-400 hover:underline"
                >
                  View
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
```

```tsx
// components/browse/FlightLogFilters.tsx
'use client'

import { Input } from '@/components/ui/input'

export function FlightLogFilters() {
  return (
    <div className="mb-6 flex flex-wrap gap-4">
      <Input placeholder="Filter by passenger..." className="max-w-xs" />
      <Input type="date" className="max-w-xs" placeholder="From date" />
      <Input type="date" className="max-w-xs" placeholder="To date" />
      <Input placeholder="Aircraft..." className="max-w-xs" />
    </div>
  )
}
```

#### Discovery Components

```tsx
// components/discovery/DiscoveryFeed.tsx
'use client'

import { useDiscoveries } from '@/lib/hooks/useDiscoveries'
import { DiscoveryCard } from './DiscoveryCard'
import { EmptyState } from '@/components/shared/EmptyState'

export function DiscoveryFeed() {
  const { discoveries, isLoading } = useDiscoveries()

  if (discoveries.length === 0) {
    return (
      <EmptyState
        variant="not-processed"
        title="No Discoveries Yet"
        description="Discoveries will appear here as the community begins solving redactions and finding connections."
        showFundingCTA
      />
    )
  }

  return (
    <div className="space-y-4">
      {discoveries.map((d) => (
        <DiscoveryCard key={d.id} discovery={d} />
      ))}
    </div>
  )
}
```

```tsx
// components/discovery/DiscoveryCard.tsx
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface Discovery {
  id: string
  type: 'redaction_solved' | 'entity_connection' | 'pattern_found'
  title: string
  description: string
  user_display_name: string | null
  cascade_count: number
  created_at: string
}

interface DiscoveryCardProps {
  discovery: Discovery
}

const TYPE_LABELS = {
  redaction_solved: 'Redaction Solved',
  entity_connection: 'Connection Found',
  pattern_found: 'Pattern Detected',
}

export function DiscoveryCard({ discovery }: DiscoveryCardProps) {
  return (
    <Card className="border-border bg-surface">
      <CardContent className="pt-4">
        <div className="mb-2 flex items-center gap-2">
          <Badge variant="outline">{TYPE_LABELS[discovery.type]}</Badge>
          <span className="text-xs text-muted-foreground">
            {new Date(discovery.created_at).toLocaleDateString()}
          </span>
        </div>
        <h3 className="mb-1 font-semibold">{discovery.title}</h3>
        <p className="text-sm text-muted-foreground">{discovery.description}</p>
        {discovery.user_display_name && (
          <p className="mt-2 text-xs text-muted-foreground">
            Discovered by @{discovery.user_display_name}
            {discovery.cascade_count > 0 && ` — Cascaded to ${discovery.cascade_count} matches`}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
```

```tsx
// components/discovery/ThisDayInFiles.tsx
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useTodayInHistory } from '@/lib/hooks/useDiscoveries'

export function ThisDayInFiles() {
  const { documents, isLoading } = useTodayInHistory()
  const today = new Date()
  const monthDay = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })

  return (
    <Card className="border-border bg-surface">
      <CardHeader>
        <CardTitle className="text-lg">This Day in the Files</CardTitle>
        <p className="text-sm text-muted-foreground">{monthDay}</p>
      </CardHeader>
      <CardContent>
        {documents.length > 0 ? (
          <div className="space-y-3">
            {documents.map((doc: { id: string; filename: string; date: string }) => (
              <div key={doc.id} className="text-sm">
                <p className="font-medium">{doc.filename}</p>
                <p className="text-xs text-muted-foreground">{doc.date}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Documents dated {monthDay} will appear here once the corpus is processed.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
```

### Step 8: Verify build

```bash
pnpm build
```

Fix any TypeScript errors. The most common will be import path issues or missing shadcn/ui components.

---

## Gotchas

1. **Server vs Client components:** Pages that use `useState`, `useSearchParams`, or other React hooks must be client components (`'use client'`). Pages that only compose server components should be server components (the default). The home page, datasets, and about pages are server components. Search, entities directory, and login are client components.

2. **`useSearchParams` requires Suspense:** Any client component using `useSearchParams()` must be wrapped in `<Suspense>`. Without it, Next.js will throw a build error. The search page shows the pattern: wrap the content in a named component and Suspense-wrap it in the default export.

3. **shadcn/ui install order:** Run all `npx shadcn@latest add` commands before creating components that import from `@/components/ui/`. If a component import fails, the shadcn component likely wasn't installed.

4. **Route group layouts:** `(public)`, `(auth)`, and `(researcher)` are route groups — they don't create URL segments. `/search` is `app/(public)/search/page.tsx`, not `/public/search`. The layouts are minimal pass-throughs for now (auth protection added in Phase 4).

5. **Empty data pattern:** All pages must render with empty arrays/null data. Never call `data.map()` without first checking `data.length > 0`. Always have a fallback EmptyState.

6. **Avoid fetching in Phase 3:** API routes don't exist yet (Phase 4). Use `enabled: false` in React Query hooks, or return mock data. The hooks are written to be ready for Phase 4 — just flip `enabled` to `true` or remove the condition.

7. **Entity type colors:** Use consistent colors across the codebase — person=blue, org=purple, location=green, aircraft=amber. The `TYPE_COLORS` map in EntityCard is the source of truth.

8. **Next.js 14 params:** In Next.js 14+ with App Router, `params` in page components is now a Promise. Use `const { id } = await params` in server components. This is a breaking change from Next.js 13.

9. **Sidebar behavior:** The Sidebar component from Phase 1 should work as a collapsible panel on desktop and a full-screen Sheet on mobile. On the search page, it contains SearchFilters. On other pages, it may not be shown.

10. **Image placeholders:** Since no actual images exist in Supabase Storage yet, use placeholder `<div>` elements with `bg-surface-elevated` instead of `<Image>` tags. Swap for real `next/image` in Phase 9 (polish).

---

## Files to Create

```
app/
├── page.tsx                          (home page — replace Phase 1 placeholder)
├── (public)/
│   ├── layout.tsx
│   ├── search/
│   │   ├── page.tsx
│   │   └── loading.tsx
│   ├── document/[id]/
│   │   ├── page.tsx
│   │   ├── loading.tsx
│   │   └── not-found.tsx
│   ├── entity/[id]/
│   │   ├── page.tsx
│   │   ├── loading.tsx
│   │   └── not-found.tsx
│   ├── entities/
│   │   ├── page.tsx
│   │   └── loading.tsx
│   ├── photos/
│   │   └── page.tsx
│   ├── audio/
│   │   └── page.tsx
│   ├── flights/
│   │   └── page.tsx
│   ├── datasets/
│   │   └── page.tsx
│   ├── discoveries/
│   │   └── page.tsx
│   └── about/
│       └── page.tsx
├── (auth)/
│   └── layout.tsx
├── (researcher)/
│   └── layout.tsx
├── login/
│   └── page.tsx
components/
├── search/
│   ├── SearchBar.tsx
│   ├── SearchResults.tsx
│   ├── SearchFilters.tsx
│   ├── ResultCard.tsx
│   ├── ImageResult.tsx
│   ├── VideoResult.tsx
│   └── AudioResult.tsx
├── document/
│   ├── DocumentViewer.tsx
│   ├── DocumentSummary.tsx
│   ├── DocumentMetadata.tsx
│   ├── DocumentCompleteness.tsx
│   ├── RedactionHighlight.tsx
│   ├── ChunkNavigator.tsx
│   ├── RelatedDocuments.tsx
│   └── ContentWarning.tsx
├── entity/
│   ├── EntityCard.tsx
│   ├── EntityProfile.tsx
│   ├── EntityTimeline.tsx
│   ├── EntityConnections.tsx
│   ├── EntityMentions.tsx
│   └── EntityDossier.tsx
├── browse/
│   ├── PhotoGallery.tsx
│   ├── PhotoLightbox.tsx
│   ├── AudioPlayer.tsx
│   ├── AudioPlaylist.tsx
│   ├── FlightLogTable.tsx
│   └── FlightLogFilters.tsx
├── discovery/
│   ├── DiscoveryFeed.tsx
│   ├── DiscoveryCard.tsx
│   └── ThisDayInFiles.tsx
lib/hooks/
├── useSearch.ts
├── useEntity.ts
├── useRandomDocument.ts
├── useDiscoveries.ts
└── useAudio.ts
```

## Acceptance Criteria

1. All pages render with appropriate empty states (no crashes on missing data)
2. Navigation between all pages works (Header links, entity cards → entity page, etc.)
3. Search page displays filters sidebar, tabs (incl. Audio), and empty state
4. Random Document button attempts navigation (with graceful fallback)
5. Document viewer shows summary placeholder, completeness tracker, content warning
6. Entity profile shows all 6 tabs including Evidence Dossier
7. Entity directory shows grid layout with type filter tabs
8. Photo gallery placeholder renders correctly
9. Audio browser shows playlist-style layout with playback controls
10. Flight log explorer shows structured table with filters
11. Datasets page lists all 12 datasets with progress bars
12. Discoveries page shows feed with "This Day in the Files"
13. Login page has email form + OAuth buttons + why sign in
14. Mobile responsive at 320px-768px (hamburger menu, stacked layouts)
15. All pages maintain dark theme consistently
16. URL search params work on search page (shareable searches)
17. Home page hero + search bar + stats section renders
18. `pnpm build` succeeds with zero errors

## Design Notes

- Entity type colors: Person = `text-blue-400`, Organization = `text-purple-400`, Location = `text-green-400`, Aircraft = `text-amber-400`
- Redaction highlight: unsolved = `border-dashed border-red-600 bg-black`, solved = `border-solid border-green-500 bg-green-950/20`
- Search result snippets: highlight matching terms with `<mark>` styled as `bg-amber-500/20 text-amber-300`
- Audio player: dark Spotify-style with waveform, synced transcript scrolling
- Photo gallery: masonry grid, lightbox with metadata sidebar
- Flight log table: sortable columns, passenger highlighting
- Evidence Dossier: formatted like a legal brief — sections for Involvement Summary, Key Documents, Relationship Evidence, Timeline of Activities

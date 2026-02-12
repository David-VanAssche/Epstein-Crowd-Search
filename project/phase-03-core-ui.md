# Phase 3: Core UI Pages

> **Sessions:** 2 | **Dependencies:** Phase 2 (types) | **Parallel with:** Phase 4 (Backend API)

## Summary

Build all the main user-facing pages with proper layouts, empty states, and navigation. Pages should render beautifully even with no data — this is what potential donors and contributors see first. Includes search with content-type-specific browse views, document viewer with AI summaries, entity pages, datasets, about, login, and discovery features. The goal is to make evidence consumption as intuitive as possible — every document should feel like it's building toward accountability.

## Checklist

### Home Page

- [ ] `app/page.tsx` — Landing page
  - Hero section: "3.5 Million Pages of Truth. Now Searchable." with large search bar
  - "How it works" section: 3 columns (Search → Discover → Unredact) with icons
  - Stats ticker: Documents processed, entities found, redactions solved (from DB or zeros)
  - Sample searches: 6 clickable example queries
  - GoFundMe embed/progress bar (placeholder URL)
  - Dark, dramatic, full-bleed sections
  - Mobile responsive

### Search Page

- [ ] `app/(public)/search/page.tsx` — Main search interface
  - Full-width search bar at top (persists on scroll via sticky)
  - Left sidebar using `<Sidebar>`: filters (dataset, doc type, date range, entity, has redactions)
  - Results area with tabs: All, Documents, Images, Videos, Entities
  - Empty state with funding CTA: "This search will query 3.5M pages once processing is funded"
  - "Ask AI" button to convert search into chat question
  - Pagination controls
  - URL search params for shareable searches

### Search Components

- [ ] `components/search/SearchBar.tsx` — Large search input with icon, submit, clear
  - "Random Document" dice button alongside search (serendipitous discovery)
  - Keyboard shortcut hint (Cmd+K)
- [ ] `components/search/SearchResults.tsx` — Container for result cards with tab switching
  - Tabs: All, Documents, Images, Audio, Videos, Entities
- [ ] `components/search/SearchFilters.tsx` — Filter controls (datasets, doc types, date range, entities)
  - Negative filters: exclude specific entities or doc types
- [ ] `components/search/ResultCard.tsx` — Individual result: title, snippet, source doc link, dataset badge, date
  - "More Like This" button on each result
  - Document completeness indicator (how much review this doc has had)
- [ ] `components/search/ImageResult.tsx` — Image result with thumbnail preview and description
- [ ] `components/search/VideoResult.tsx` — Video transcript result with timestamp
- [ ] `components/search/AudioResult.tsx` — Audio result with waveform preview and timestamp

### Document Viewer

- [ ] `app/(public)/document/[id]/page.tsx` — Document viewer page
  - AI-generated executive summary at top (3-5 sentences: what it is, who's mentioned, significance)
  - Document content viewer (monospace text, page numbers)
  - Metadata sidebar (filename, classification, dataset, date, page count)
  - Redaction highlights (red dashed borders for unsolved, green glow for solved)
  - Document completeness checklist (OCR verified, entities confirmed, dates validated, etc.)
  - Related documents panel ("More Like This" via semantic similarity)
  - Chunk navigator (jump between relevant chunks)
  - Annotation layer (margin notes from other researchers — Phase 5 integration point)
  - Content sensitivity warning (configurable, for disturbing content)
  - "This document was made searchable thanks to community funding" footer
  - Source provenance badge (which dataset, original filing reference)
  - Loading state with skeleton
  - Not-found state

### Document Components

- [ ] `components/document/DocumentViewer.tsx` — Main content viewer with page navigation
- [ ] `components/document/DocumentSummary.tsx` — AI-generated executive summary card
- [ ] `components/document/DocumentMetadata.tsx` — Metadata sidebar panel
- [ ] `components/document/DocumentCompleteness.tsx` — Review checklist (what's been verified)
- [ ] `components/document/RedactionHighlight.tsx` — Inline redaction highlight with tooltip
- [ ] `components/document/ChunkNavigator.tsx` — Navigate between chunks/pages
- [ ] `components/document/RelatedDocuments.tsx` — Similar documents cards
- [ ] `components/document/ContentWarning.tsx` — Configurable sensitivity warning overlay

### Entity Pages

- [ ] `app/(public)/entity/[id]/page.tsx` — Entity profile page
  - Header: name, type badge (colored pill), aliases, mention count, document count
  - 6 tabs: Overview, Documents, Connections, Timeline, Redactions, Evidence Dossier
  - Overview tab: AI summary, key facts, first/last seen dates
  - Documents tab: list of documents mentioning this entity
  - Connections tab: mini relationship graph (placeholder for D3, built in Phase 8)
  - Timeline tab: chronological appearances
  - Redactions tab: redactions where this entity might be hidden text
  - Evidence Dossier tab: auto-generated prosecutor-ready summary of all evidence linking this entity to potential criminal activity (document references, relationship patterns, timeline of involvement, co-occurring entities)
  - "Export Dossier" button (PDF/JSON) — formatted for legal review
  - Empty state with entity count + funding CTA

- [ ] `app/(public)/entities/page.tsx` — Entity directory/browser
  - Search/filter bar
  - Entity type filter tabs (All, People, Organizations, Locations)
  - Grid of entity cards
  - Pagination
  - Empty state

### Entity Components

- [ ] `components/entity/EntityCard.tsx` — Compact card (name, type badge, mention count)
- [ ] `components/entity/EntityProfile.tsx` — Full profile content with tabs
- [ ] `components/entity/EntityTimeline.tsx` — Timeline of entity mentions
- [ ] `components/entity/EntityConnections.tsx` — Relationship list (graph built in Phase 8)
- [ ] `components/entity/EntityMentions.tsx` — Document mention list with context snippets

### Content-Type Specific Browse Pages

- [ ] `app/(public)/photos/page.tsx` — Photo gallery (Google Photos-style)
  - Masonry/grid layout of all corpus images
  - Filter by dataset, date, has redaction, has identified people
  - Lightbox on click with full metadata + "Who's in this photo?" CTA
  - Empty state with funding CTA

- [ ] `app/(public)/audio/page.tsx` — Audio browser (Spotify-style dark UI)
  - Playlist-style organization by dataset and type (depositions, court recordings, etc.)
  - Playback controls, waveform visualization
  - Transcript alongside audio (synced scrolling)
  - Empty state

- [ ] `app/(public)/flights/page.tsx` — Flight log explorer
  - Structured table view of flight manifest data
  - Filter by passenger, date range, aircraft, origin/destination
  - Sortable columns
  - Click row → document viewer at source page
  - Map visualization of routes (placeholder for Phase 8)

### Other Pages

- [ ] `app/(public)/datasets/page.tsx` — Browse 12 DOJ datasets
  - Dataset cards with name, description, doc/page counts, processing status
  - Progress bar per dataset
  - Content type breakdown per dataset (docs, images, audio, video)
  - Download link (justice.gov source URL)
  - Empty state for unprocessed datasets

- [ ] `app/(public)/about/page.tsx` — About page
  - Project overview and mission
  - **"For Prosecutors" section** — how this platform prepares evidence for legal action
  - Methodology (how OCR, embedding, entity extraction works)
  - FAQ section
  - Contributing section with link to GitHub
  - Media kit section (how to cite, verify findings, contact for press)
  - Team/credits placeholder
  - Contact information

- [ ] `app/(public)/discoveries/page.tsx` — Public discovery feed / changelog
  - Chronological feed of confirmed redaction solves, new entity connections, pattern discoveries
  - "This Day in the Files" — documents dated on today's date in history
  - RSS subscribable
  - Shareable discovery cards

- [ ] `app/login/page.tsx` — Login page
  - Email/password form
  - Google OAuth button
  - GitHub OAuth button
  - "Why sign in?" explanation (contribute, save searches, earn XP)
  - Onboarding quiz: background (journalist, lawyer, researcher, citizen) + interests
  - Redirect after login

### Hooks

- [ ] `lib/hooks/useSearch.ts` — Search state management with React Query
  - Query, filters, pagination state
  - Debounced search input
  - URL search param sync
  - Negative filter support (exclude entities, doc types)
- [ ] `lib/hooks/useEntity.ts` — Entity data fetching with React Query
  - Entity profile data
  - Entity mentions
  - Entity connections
  - Evidence dossier data
- [ ] `lib/hooks/useRandomDocument.ts` — Random document discovery
  - Fetch random document ID from API
  - Navigate to document viewer
- [ ] `lib/hooks/useDiscoveries.ts` — Discovery feed data
  - Recent discoveries, "This Day in the Files"
- [ ] `lib/hooks/useAudio.ts` — Audio playback state
  - Current track, playback position, transcript sync

### Loading & Error States

- [ ] `app/(public)/search/loading.tsx` — Search page skeleton
- [ ] `app/(public)/document/[id]/loading.tsx` — Document viewer skeleton
- [ ] `app/(public)/entity/[id]/loading.tsx` — Entity profile skeleton
- [ ] `app/(public)/entities/loading.tsx` — Entity directory skeleton
- [ ] `app/(public)/document/[id]/not-found.tsx` — Document not found
- [ ] `app/(public)/entity/[id]/not-found.tsx` — Entity not found

## Files to Create

```
app/
├── page.tsx                          (home page — replace Phase 1 placeholder)
├── (public)/
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
4. Random Document button navigates to a random document
5. Document viewer shows AI summary, completeness tracker, content warning
6. Entity profile shows all 6 tabs including Evidence Dossier
7. Entity directory shows grid layout with type filter tabs
8. Photo gallery displays masonry grid with lightbox
9. Audio browser shows playlist-style layout with playback controls
10. Flight log explorer shows structured table with filters
11. Datasets page lists all 12 datasets with content type breakdowns
12. Discoveries page shows feed with "This Day in the Files"
13. Login page has email form + OAuth buttons + onboarding quiz
14. Mobile responsive at 320px-768px (hamburger menu, stacked layouts)
15. All pages maintain dark theme consistently
16. URL search params work on search page (shareable searches)
17. Home page hero + search bar + stats section renders

## Design Notes

- Entity type colors: Person = blue (`text-blue-400`), Organization = purple (`text-purple-400`), Location = green (`text-green-400`), Aircraft = amber (`text-amber-400`)
- Redaction highlight: unsolved = `border-dashed border-red-600 bg-black`, solved = `border-solid border-green-500 bg-green-950/20`
- Search result snippets: highlight matching terms with `<mark>` styled as `bg-amber-500/20 text-amber-300`
- Stats ticker on home page: use `CountUp` animation or simple number display
- Audio player: dark Spotify-style with waveform, synced transcript scrolling
- Photo gallery: masonry grid, lightbox with metadata sidebar, "Who's in this photo?" button
- Flight log table: sortable columns, passenger highlighting, route visualization placeholder
- Evidence Dossier: formatted like a legal brief — sections for Involvement Summary, Key Documents, Relationship Evidence, Timeline of Activities, Cross-References

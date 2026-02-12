# Phase 3: Core UI Pages

> **Sessions:** 2 | **Dependencies:** Phase 2 (types) | **Parallel with:** Phase 4 (Backend API)

## Summary

Build all the main user-facing pages with proper layouts, empty states, and navigation. Pages should render beautifully even with no data — this is what potential donors and contributors see first. Includes search, document viewer, entity pages, datasets, about, and login.

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
- [ ] `components/search/SearchResults.tsx` — Container for result cards with tab switching
- [ ] `components/search/SearchFilters.tsx` — Filter controls (datasets, doc types, date range, entities)
- [ ] `components/search/ResultCard.tsx` — Individual result: title, snippet, source doc link, dataset badge, date
- [ ] `components/search/ImageResult.tsx` — Image result with thumbnail preview and description
- [ ] `components/search/VideoResult.tsx` — Video transcript result with timestamp

### Document Viewer

- [ ] `app/(public)/document/[id]/page.tsx` — Document viewer page
  - Document content viewer (monospace text, page numbers)
  - Metadata sidebar (filename, classification, dataset, date, page count)
  - Redaction highlights (red dashed borders for unsolved, green glow for solved)
  - Related documents panel
  - Chunk navigator (jump between relevant chunks)
  - "This document was made searchable thanks to community funding" footer
  - Loading state with skeleton
  - Not-found state

### Document Components

- [ ] `components/document/DocumentViewer.tsx` — Main content viewer with page navigation
- [ ] `components/document/DocumentMetadata.tsx` — Metadata sidebar panel
- [ ] `components/document/RedactionHighlight.tsx` — Inline redaction highlight with tooltip
- [ ] `components/document/ChunkNavigator.tsx` — Navigate between chunks/pages
- [ ] `components/document/RelatedDocuments.tsx` — Similar documents cards

### Entity Pages

- [ ] `app/(public)/entity/[id]/page.tsx` — Entity profile page
  - Header: name, type badge (colored pill), aliases, mention count, document count
  - 5 tabs: Overview, Documents, Connections, Timeline, Redactions
  - Overview tab: AI summary, key facts, first/last seen dates
  - Documents tab: list of documents mentioning this entity
  - Connections tab: mini relationship graph (placeholder for D3, built in Phase 8)
  - Timeline tab: chronological appearances
  - Redactions tab: redactions where this entity might be hidden text
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

### Other Pages

- [ ] `app/(public)/datasets/page.tsx` — Browse 12 DOJ datasets
  - Dataset cards with name, description, doc/page counts, processing status
  - Progress bar per dataset
  - Download link (justice.gov source URL)
  - Empty state for unprocessed datasets

- [ ] `app/(public)/about/page.tsx` — About page
  - Project overview and mission
  - Methodology (how OCR, embedding, entity extraction works)
  - FAQ section
  - Contributing section with link to GitHub
  - Team/credits placeholder
  - Contact information

- [ ] `app/login/page.tsx` — Login page
  - Email/password form
  - Google OAuth button
  - GitHub OAuth button
  - "Why sign in?" explanation (contribute, save searches, earn XP)
  - Redirect after login

### Hooks

- [ ] `lib/hooks/useSearch.ts` — Search state management with React Query
  - Query, filters, pagination state
  - Debounced search input
  - URL search param sync
- [ ] `lib/hooks/useEntity.ts` — Entity data fetching with React Query
  - Entity profile data
  - Entity mentions
  - Entity connections

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
│   ├── datasets/
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
│   └── VideoResult.tsx
├── document/
│   ├── DocumentViewer.tsx
│   ├── DocumentMetadata.tsx
│   ├── RedactionHighlight.tsx
│   ├── ChunkNavigator.tsx
│   └── RelatedDocuments.tsx
├── entity/
│   ├── EntityCard.tsx
│   ├── EntityProfile.tsx
│   ├── EntityTimeline.tsx
│   ├── EntityConnections.tsx
│   └── EntityMentions.tsx
lib/hooks/
├── useSearch.ts
└── useEntity.ts
```

## Acceptance Criteria

1. All pages render with appropriate empty states (no crashes on missing data)
2. Navigation between all pages works (Header links, entity cards → entity page, etc.)
3. Search page displays filters sidebar, tabs, and empty state
4. Document viewer shows loading skeleton then "document not found" for invalid IDs
5. Entity profile shows all 5 tabs (even if content is placeholder)
6. Entity directory shows grid layout with type filter tabs
7. Datasets page lists all 12 datasets with placeholder data
8. Login page has email form + OAuth buttons
9. Mobile responsive at 320px-768px (hamburger menu, stacked layouts)
10. All pages maintain dark theme consistently
11. URL search params work on search page (shareable searches)
12. Home page hero + search bar + stats section renders

## Design Notes

- Entity type colors: Person = blue (`text-blue-400`), Organization = purple (`text-purple-400`), Location = green (`text-green-400`), Aircraft = amber (`text-amber-400`)
- Redaction highlight: unsolved = `border-dashed border-red-600 bg-black`, solved = `border-solid border-green-500 bg-green-950/20`
- Search result snippets: highlight matching terms with `<mark>` styled as `bg-amber-500/20 text-amber-300`
- Stats ticker on home page: use `CountUp` animation or simple number display

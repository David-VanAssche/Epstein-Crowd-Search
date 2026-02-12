# Phase 7: Funding & Stats

> **Sessions:** 1 | **Dependencies:** Phase 3 (UI pages), Phase 4 (API routes) | **Parallel with:** Phase 5 (Interactive Features)

## Summary

Build the live funding tracker page, donation impact calculator, spend transparency log, corpus stats page, corpus coverage heatmap, document completeness dashboard, "This Day in the Files" feature, and research activity tracking. Funding visibility is critical for driving donations — every page should connect users to the funding story and show exactly where attention is needed.

## Checklist

### Funding Page

- [ ] `app/(public)/funding/page.tsx` — Live funding tracker
  - Hero: giant progress bar — "$X raised of $16,000 goal" with animated fill
  - "Your Dollar, Visualized" interactive calculator section
  - Impact tier cards section (10 tiers)
  - Spend transparency log (scrollable feed)
  - Live processing feed (when worker is active)
  - "Every penny accounted for" section with spend category breakdown
  - GoFundMe widget embed (placeholder iframe)
  - Mobile responsive

### Funding Components

- [ ] `components/funding/FundingTracker.tsx` — Live donation total + goal progress
  - Large progress bar with percentage
  - Animated number counting up
  - "$X raised of $16,000" with donor count
  - Subtle pulsing glow on the progress fill

- [ ] `components/funding/DonationImpactCalc.tsx` — Interactive calculator
  - Slider from $1 to $500+ (logarithmic scale)
  - Live visualization: pages flipping, entities appearing as slider moves
  - Output text: "Your $X would process Y pages, uncover ~Z entity mentions"
  - Direct donate button with amount prefilled

- [ ] `components/funding/DonationImpactTiers.tsx` — Visual tier cards
  - 10 tier cards from scaffold spec:
    - $1 (475 pages), $5 (2,400), $10 (4,750), $25 (12,000), $50 (24,000)
    - $100 (48,000), $250 (119,000), $500 (238,000), $1,500 (714,000), $5,000 (2,380,000)
  - Each card: amount, pages processed, description, analogy, donate link
  - Responsive grid (2 cols mobile, 3-5 cols desktop)

- [ ] `components/funding/SpendTransparencyLog.tsx` — Public spend log
  - Scrollable feed of processing batches
  - Each entry: date, amount, service, description, results (pages, entities, redactions)
  - Filter by service type or date range
  - "Every dollar accounted for" header

- [ ] `components/funding/ProcessingLiveFeed.tsx` — Real-time processing feed
  - Shows recently processed documents
  - "Just processed: FBI_302_report.pdf (12 pages, 3 entities)" format
  - Auto-scrolling when active, "Worker idle" when not
  - Polling or SSE for real-time updates

- [ ] `components/funding/DonationCTA.tsx` — Reusable donate call-to-action
  - Compact bar variant (for home page, headers)
  - Card variant (for empty states)
  - Banner variant (for top-of-page dismissible banner)
  - All link to GoFundMe (placeholder URL)

### Funding Integration on Other Pages

- [ ] Update `app/page.tsx` (home) — Add compact funding bar below hero
  - "$X of $16K raised — Your $5 processes 2,400 pages [Donate →]"

- [ ] Update `components/search/SearchResults.tsx` — Funding CTA in empty state
  - "This search would find results across 3.5M pages. We've processed X so far. [Fund the rest →]"

- [ ] Update `components/layout/Header.tsx` — Add dismissible funding banner
  - "XX% of documents processed. Help unlock the rest → [Donate]"
  - Dismissible (stored in localStorage)

- [ ] Update `components/document/DocumentViewer.tsx` — Add funding footer
  - "This document was made searchable thanks to community funding. [Process more →]"

### Funding API Routes

- [ ] `app/api/funding/status/route.ts` — Live funding status
  - GET: Return current funding_status (raised, goal, percentage, donor count)
  - Cached (refresh every 15 minutes from GoFundMe if available)

- [ ] `app/api/funding/impact/route.ts` — Calculate donation impact
  - GET: amount parameter → returns { pages, entities_estimated, analogy }
  - Uses donation_impact_tiers for interpolation

- [ ] `app/api/funding/spend-log/route.ts` — Public transparency log
  - GET: Paginated spend log entries
  - Optional filters: service, date_from, date_to

### Stats Page

- [ ] `app/(public)/stats/page.tsx` — Corpus statistics & processing progress
  - Processing progress section:
    - Overall: X of 3.5M pages processed (large progress bar)
    - Per dataset: 12 dataset progress bars with names
  - Corpus stats section:
    - Total documents, total pages, total chunks
    - Total images, total videos
    - Total entities (by type breakdown)
    - Total relationships
    - Total redactions (by status breakdown: solved, proposed, unsolved)
  - Contributor stats: total contributors, total proposals, accuracy rate

### Stats Components

- [ ] `components/stats/ProcessingProgress.tsx` — Processing progress bars
  - Main progress bar (total pages)
  - Per-dataset progress bars (12 datasets)
  - Percentage and counts
  - Color-coded (green for complete, amber for in-progress, gray for pending)

- [ ] `components/stats/CorpusStats.tsx` — Total counts and breakdowns
  - Grid of stat cards with icons
  - Numbers with animation on load
  - Criminal activity indicators section (how many documents flagged, by category)

- [ ] `components/stats/FundingProgress.tsx` — Funding progress for stats page
  - Compact version of FundingTracker
  - Shows $ raised → pages processed conversion

### Corpus Coverage Heatmap

- [ ] `components/stats/CoverageHeatmap.tsx` — Visual coverage matrix
  - Matrix showing datasets × document types
  - Color intensity = percentage of documents reviewed by community
  - Highlights blind spots (under-researched areas in red/orange)
  - Click cell → filtered search for that dataset+type combination
  - "Most under-researched areas" callout

- [ ] `components/stats/ResearchActivityMap.tsx` — Where researchers are focusing
  - Time-based heatmap showing research activity over past 7/30 days
  - Which entities are getting the most attention
  - Which datasets have the most annotations
  - "Under-explored" sections highlighted

### Document Completeness Dashboard

- [ ] `components/stats/CompletenessTracker.tsx` — Document review progress
  - How many documents have been:
    - OCR verified by community
    - Entities confirmed by community
    - Dates validated
    - Redactions attempted
    - Cross-references checked
  - Overall "community verification percentage"
  - "Claim a document to review" CTA

### Smart Priority Queue

- [ ] `components/stats/NeedsEyesFeed.tsx` — "Needs Eyes" document queue
  - Documents ranked by: entity density × redaction count × low review count
  - "This document has 12 redactions and 8 entity mentions but hasn't been reviewed yet"
  - "Claim for review" button
  - Filter by dataset, doc type, difficulty estimate

### Prosecutor Dashboard

- [ ] `app/(public)/prosecutors/page.tsx` — Prosecutor-ready overview
  - "For Law Enforcement & Legal Professionals" header
  - Per-entity evidence summaries with citation counts
  - Criminal activity indicator breakdowns
  - Most-connected entities (by relationship strength)
  - Most-flagged documents (highest criminal indicator scores)
  - "Export Full Evidence Package" button
  - How to verify findings, chain of custody notes
  - Contact information for legal inquiries

## Files to Create

```
app/(public)/
├── funding/
│   └── page.tsx
├── stats/
│   └── page.tsx
└── prosecutors/
    └── page.tsx
components/funding/
├── FundingTracker.tsx
├── DonationImpactCalc.tsx
├── DonationImpactTiers.tsx
├── SpendTransparencyLog.tsx
├── ProcessingLiveFeed.tsx
└── DonationCTA.tsx
components/stats/
├── ProcessingProgress.tsx
├── CorpusStats.tsx
├── FundingProgress.tsx
├── CoverageHeatmap.tsx
├── ResearchActivityMap.tsx
├── CompletenessTracker.tsx
└── NeedsEyesFeed.tsx
app/api/funding/
├── status/
│   └── route.ts
├── impact/
│   └── route.ts
└── spend-log/
    └── route.ts
```

## Updates to Existing Files

```
app/page.tsx                              — Add compact funding bar
components/search/SearchResults.tsx       — Add funding CTA in empty state
components/layout/Header.tsx              — Add dismissible funding banner
components/document/DocumentViewer.tsx    — Add funding footer
```

## Acceptance Criteria

1. Funding page renders with $0/$16,000 progress bar
2. Impact calculator slider is interactive ($1-$500+) with live output
3. All 10 donation impact tier cards display correctly
4. Spend transparency log shows empty state ("No processing spend yet")
5. Processing live feed shows "Worker idle" state
6. Funding API returns current status with correct response shape
7. Impact API calculates correct pages for a given amount (using $2.10/1K pages formula)
8. Spend log API returns paginated results
9. Stats page shows all corpus stats (zeros initially)
10. Per-dataset progress bars display for all 12 datasets
11. Funding CTA appears on home page, search empty state, document footer
12. Dismissible banner works (dismissed state persists in localStorage)
13. All components are mobile responsive
14. Coverage heatmap shows dataset × doc type matrix with blind spot highlighting
15. Research activity map shows where community attention is focused
16. Document completeness tracker shows verification progress
17. "Needs Eyes" feed surfaces high-priority unreviewed documents
18. Prosecutor dashboard shows per-entity evidence summaries with export option

## Notes

- GoFundMe widget embed: use placeholder `<iframe>` with a comment explaining how to get the real widget URL
- The $2.10 per 1,000 pages cost model is the basis for all impact calculations
- Spend log entries are created by the worker pipeline (Phase 6) — this phase just displays them
- Processing live feed can use polling (every 10s) for v1, SSE for v2
- Stats come from the `corpus_stats` materialized view — needs periodic refresh

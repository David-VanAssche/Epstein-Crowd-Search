# Phase 13: Research Tools & Monitoring UI

> **Sessions:** 3-4 | **Dependencies:** Phase 11, Phase 12 | **Parallel with:** Nothing

## Summary

Build the user-facing pages and components for all Phase 11-12 data: Email Browser, Financial Flow Viewer (with D3 Sankey diagram), Contradiction Tracker, Network Analysis Dashboard, Property Ownership Timeline, Ghost Flight badges, DOJ Release Monitor, Thread Convergence display, and person category enhancements. Adds 4 new pages (/emails, /finances, /contradictions, /analysis), ~35 components, 9 API routes, 4 hooks, and updates the Header navigation with a "More" dropdown to handle 12+ nav items.

## IMPORTANT: Dependencies on Prior Phases

- Phase 11: All schema tables (emails, financial_transactions, contradictions, etc.) must exist
- Phase 12: All API routes (centrality, flight-stats, graph/entities, etc.) must be deployed
- Phase 12: Materialized views must be populated for analysis page to show data

---

## Step-by-Step Execution

### Step 1: Install d3-sankey dependency

```bash
pnpm add d3-sankey @types/d3-sankey
```

### Step 2: Create migration `00023_research_tools.sql`

File: `supabase/migrations/00023_research_tools.sql` — NEW

- `doj_releases` table (id, title, release_date, url, summary, release_type, is_new)
- `contradiction_votes` table with auto-update trigger for verify/dispute counts on contradictions
- RLS policies (public read for doj_releases, auth write for contradiction_votes)

### Step 3: Create type definitions

Files:
- `types/emails.ts` — EmailListItem, EmailDetail, EmailThread, EmailFiltersState
- `types/finance.ts` — FinancialTransactionListItem, FinancialSummary, FinancialFlowNode, FinancialFlowLink
- `types/contradictions.ts` — ContradictionListItem, ContradictionDetail, ContradictionFiltersState

### Step 4: Add Zod schemas

File: `lib/api/schemas.ts` — MODIFY

New schemas: `emailQuerySchema`, `financialQuerySchema`, `contradictionCreateSchema`, `contradictionQuerySchema`, `contradictionVoteSchema`, `networkAnalysisSchema`

### Step 5: Create API routes (9 routes)

Files:
- `app/api/emails/route.ts` — paginated, full-text search, entity/date/attachment filters
- `app/api/financial-transactions/route.ts` — paginated with entity/amount/type/suspicious filters
- `app/api/financial-transactions/summary/route.ts` — aggregation: totals, by-type, by-year, top senders/receivers
- `app/api/contradictions/route.ts` — GET (paginated, filtered) + POST (auth required)
- `app/api/contradictions/[id]/verify/route.ts` — POST with vote upsert (auth required)
- `app/api/doj-releases/route.ts` — simple list query
- `app/api/analysis/centrality/route.ts` — paginated entity_network_metrics query
- `app/api/entity/[id]/ownership/route.ts` — returns as_property + as_owner arrays
- `app/api/investigation-threads/[id]/convergences/route.ts` — thread convergence with related thread info

### Step 6: Create hooks

Files:
- `lib/hooks/useEmails.ts` — useEmails(filters, page) with React Query
- `lib/hooks/useFinancialTransactions.ts` — useFinancialTransactions(filters, page) + useFinancialSummary()
- `lib/hooks/useContradictions.ts` — useContradictions(severity, page) + useContradictionVote()
- `lib/hooks/usePropertyOwnership.ts` — usePropertyOwnership(entityId)

### Step 7: Email Browser page + components

Files:
- `app/(public)/emails/page.tsx` — email browser with filters, list, pagination
- `components/email/EmailFilters.tsx` — search, date range, attachment toggle
- `components/email/EmailList.tsx` — card list with sender, recipient, date, attachment badges
- `components/email/EmailMessage.tsx` — full email detail view with headers, body, attachments

### Step 8: Financial Flow Viewer page + components

Files:
- `app/(public)/finances/page.tsx` — tabbed view (Transactions, Overview, Flow Diagram)
- `components/finance/TransactionFilters.tsx` — type, amount range, date, suspicious toggle
- `components/finance/TransactionList.tsx` — card list with sender → receiver, amount, suspicious badges
- `components/finance/FinancialSummary.tsx` — stat cards (total volume, transaction count, suspicious count)
- `components/finance/FinancialFlowDiagram.tsx` — D3 Sankey diagram (dynamically imported, SSR: false pattern via useEffect import)

### Step 9: Contradiction Tracker page

File: `app/(public)/contradictions/page.tsx` — severity filter, side-by-side claim cards, verify/dispute counts, expand for description, pagination

### Step 10: Network Analysis Dashboard page + components

Files:
- `app/(public)/analysis/page.tsx` — dashboard with links to graph/path finder
- `components/analysis/NetworkDashboard.tsx` — layout wrapper
- `components/analysis/CentralityLeaderboard.tsx` — sortable list (PageRank/betweenness/degree)
- `components/analysis/TemporalHeatmap.tsx` — D3 horizontal bar chart of flight frequency

### Step 11: Miscellaneous components

Files:
- `components/browse/GhostFlightBadge.tsx` — red/amber badge with tooltip for missing/partial manifests
- `components/stats/DOJReleaseTracker.tsx` — card list with release date, type badge, new badge
- `components/entity/PropertyOwnershipTimeline.tsx` — vertical timeline with ownership records + owned properties list
- `components/investigation/ThreadConvergence.tsx` — convergence cards with overlap type, shared entity count
- `components/investigation/RelatedThreadsSidebar.tsx` — sidebar wrapper for ThreadConvergence

### Step 12: Update Header navigation

File: `components/layout/Header.tsx` — MODIFY

Split nav into `primaryNav` (6 items: Search, Entities, Timeline, Flights, Emails, Finances) and `moreNav` (6 items: Redactions, Contradictions, Analysis, Photos, Audio, Sources). Desktop shows primary items + "More" dropdown. Mobile sheet shows all 12 items.

---

## Gotchas

1. D3 Sankey (`d3-sankey`) must be dynamically imported — `import('d3-sankey')` in useEffect to avoid SSR issues
2. FinancialFlowDiagram builds Sankey from summary API (senders → types → receivers) not individual transactions
3. Contradiction vote endpoint deletes old vote before inserting new one (upsert via trigger)
4. CentralityLeaderboard sorts by `pagerank` by default but metric column name must match API sort param
5. TemporalHeatmap uses `d3.scaleSequential(d3.interpolateYlOrRd)` — good contrast on dark backgrounds
6. GhostFlightBadge only renders for `missing` or `partial` manifest_status (not `full` or null)
7. Header `moreNav` active state check: if any `moreNav` href matches pathname, highlight "More" button
8. PropertyOwnershipTimeline renders two sections: "Ownership History" (who owned this property) and "Properties Owned" (what this entity owns)
9. TransactionList uses `suspicious_reasons` (not `suspicious_flags`) matching the type definition
10. All D3 visualizations handle empty data gracefully (show "no data" message, not blank canvas)

## Files Created/Modified

```
NEW PAGES:
  app/(public)/emails/page.tsx
  app/(public)/finances/page.tsx
  app/(public)/contradictions/page.tsx
  app/(public)/analysis/page.tsx

NEW COMPONENTS:
  components/email/EmailFilters.tsx
  components/email/EmailList.tsx
  components/email/EmailMessage.tsx
  components/finance/TransactionFilters.tsx
  components/finance/TransactionList.tsx
  components/finance/FinancialSummary.tsx
  components/finance/FinancialFlowDiagram.tsx
  components/analysis/NetworkDashboard.tsx
  components/analysis/CentralityLeaderboard.tsx
  components/analysis/TemporalHeatmap.tsx
  components/browse/GhostFlightBadge.tsx
  components/stats/DOJReleaseTracker.tsx
  components/entity/PropertyOwnershipTimeline.tsx
  components/investigation/ThreadConvergence.tsx
  components/investigation/RelatedThreadsSidebar.tsx

NEW API ROUTES:
  app/api/emails/route.ts
  app/api/financial-transactions/route.ts
  app/api/financial-transactions/summary/route.ts
  app/api/contradictions/route.ts
  app/api/contradictions/[id]/verify/route.ts
  app/api/doj-releases/route.ts
  app/api/analysis/centrality/route.ts
  app/api/entity/[id]/ownership/route.ts
  app/api/investigation-threads/[id]/convergences/route.ts

NEW TYPES:
  types/emails.ts
  types/finance.ts
  types/contradictions.ts

NEW HOOKS:
  lib/hooks/useEmails.ts
  lib/hooks/useFinancialTransactions.ts
  lib/hooks/useContradictions.ts
  lib/hooks/usePropertyOwnership.ts

MODIFIED:
  components/layout/Header.tsx
  lib/api/schemas.ts
  package.json
```

## Acceptance Criteria

- [x] Email browser loads, searches, filters, and paginates
- [x] Ghost flights display red badges
- [x] Financial Sankey diagram renders with entity nodes and flow widths
- [x] Contradiction side-by-side comparison works; voting updates counts
- [x] Property entities show ownership timeline
- [x] DOJ release monitor displays releases with new badges
- [x] Network analysis dashboard shows centrality leaderboard and flight frequency
- [x] Header navigation handles 12 items with "More" dropdown (desktop) and full list (mobile)
- [x] All D3 visualizations dynamically imported (no SSR)
- [x] `pnpm build` passes

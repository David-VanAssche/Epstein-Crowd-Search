# Phase 3: Investigation UI

> **Status:** Not started
> **Estimated effort:** 16-20 hours
> **Depends on:** Phase 1 (data import — investigation reports + entities must exist in DB)

## Goal

Build three new UI features that surface rhowardstone's investigation reports and congressional scoring to end users: a reports browser, a researcher's guide, and redaction quality badges.

## Tasks

### 3.1 Investigation Reports Page (`/reports`)

**New files:**
- `app/(public)/reports/page.tsx` — Reports listing page
- `app/(public)/reports/[slug]/page.tsx` — Individual report view
- `components/reports/ReportCard.tsx` — Card component
- `components/reports/ReportFilters.tsx` — Filter bar
- `app/api/reports/route.ts` — API endpoint

**Reports listing page:**
- Server component that fetches from `investigation_reports` table
- Filter by tags (multi-select), congressional score range (slider), entity search
- Sort by: congressional score (default), date, entity count
- Pagination with infinite scroll (reuse pattern from DiscoveryFeed)

**ReportCard component:**
```tsx
// Expandable card showing:
// - Congressional score badge (color-coded: red 90+, orange 70-89, yellow 50-69, gray <50)
// - Title
// - Entity chips (first 5, +N more)
// - Document reference count
// - Tags as badges
// - 2-line summary preview
// - Click to expand or navigate to /reports/[slug]
```

**Individual report page:**
- Full markdown rendering via `react-markdown` + `remark-gfm` (already installed)
- Entity names hyperlinked to `/entities/[id]` (regex match against known entity names)
- Document references hyperlinked to `/documents/[id]`
- Sidebar: linked entities list, linked documents list, related reports (same tags)

**API endpoint:**
```typescript
// GET /api/reports?tags=financial&min_score=70&entity=maxwell&sort=score&page=1
// Returns paginated reports with entity/document counts
```

### 3.2 Researcher's Guide (`/start-here`)

**New files:**
- `app/(public)/start-here/page.tsx` — Guide page
- `components/guide/PriorityTier.tsx` — Collapsible priority tier
- `components/guide/ReadingPath.tsx` — Curated document sequence

**Layout:**
- Hero section: "Where to begin with 2.7 million pages"
- Priority tiers (collapsible): Critical (90-100), High (70-89), Medium (50-69)
- Each tier shows: document count, report count, entity count
- Expandable to show top documents/reports in that tier
- Reading paths: curated sequences like "Financial Trail", "Travel Pattern", "Victim Testimony"

**Priority tier data:**
```typescript
// Fetch from DB
const tiers = await supabase.rpc('get_priority_tiers');
// Returns: { tier: 'critical', docs: 12, reports: 4, entities: 8, items: [...] }
```

**Reading paths:**
- Initially static content (JSON/markdown) curated from rhowardstone's analysis
- Each path is an ordered list of document IDs + brief annotations
- Future: user-created reading paths (not in this phase)

**RPC function:** `supabase/migrations/00038_guide_functions.sql`
```sql
CREATE OR REPLACE FUNCTION get_priority_tiers()
RETURNS TABLE(
  tier TEXT,
  min_score INT,
  max_score INT,
  doc_count BIGINT,
  report_count BIGINT,
  top_documents JSONB,
  top_reports JSONB
)
LANGUAGE sql STABLE
AS $$
  -- Returns aggregated tier data for the /start-here page
  ...
$$;
```

### 3.3 Redaction Quality Badges

**Modify:**
- `components/redaction/SolvableRedactionCard.tsx` — Add detection method badges
- `types/redaction.ts` — Add `detection_method` type

**Detection method badge component:**
```tsx
// New component: components/redaction/DetectionBadge.tsx
type DetectionMethod = 'spatial' | 'ocr_layer' | 'llm' | 'manual' | 'corroborated';

function DetectionBadge({ method, confidence }: { method: DetectionMethod; confidence: number }) {
  const config = {
    spatial:      { label: 'Spatial',    color: 'green',  icon: Square, description: 'Black rectangle detected in PDF' },
    ocr_layer:    { label: 'OCR Layer',  color: 'yellow', icon: Eye,    description: 'Hidden text found under redaction' },
    llm:          { label: 'AI Analysis', color: 'blue',   icon: Bot,    description: 'LLM context analysis' },
    manual:       { label: 'Manual',     color: 'purple', icon: User,   description: 'Human annotation' },
    corroborated: { label: 'Corroborated', color: 'emerald', icon: CheckCheck, description: 'Multiple methods agree' },
  };
  // Render as Badge with tooltip
}
```

**Integration with SolvableRedactionCard:**
- Show detection method badges below the redaction text
- If multiple methods detected the same redaction, show "Corroborated" badge
- Confidence indicator: filled dots (1-5) based on confidence score
- Tooltip on hover explains the detection method and its reliability

### 3.4 Sidebar Navigation Update

**Modify:** `components/layout/AppSidebar.tsx`

Add "Reports" and "Start Here" to the navigation:

```
Investigate
  ├── Start Here          ← NEW (guide icon)
  ├── Search
  ├── Chat
  └── ...
Browse
  ├── Documents
  ├── Entities
  ├── Reports             ← NEW (file-text icon)
  ├── Media               ← RENAMED from Audio
  └── ...
```

## Checklist

- [ ] 3.1 Investigation reports page created (`/reports`)
- [ ] 3.1 Individual report view with markdown rendering
- [ ] 3.1 Reports API endpoint with filtering/pagination
- [ ] 3.1 Report data seeded from Phase 1 import
- [ ] 3.2 Researcher's guide page created (`/start-here`)
- [ ] 3.2 Priority tier components with real data
- [ ] 3.2 Reading paths (initially 3-5 curated paths)
- [ ] 3.2 RPC function for priority tier aggregation
- [ ] 3.3 Detection badge component created
- [ ] 3.3 SolvableRedactionCard updated with badges
- [ ] 3.3 Tooltip explanations for each detection method
- [ ] 3.4 Sidebar navigation updated (Reports, Start Here, Media rename)
- [ ] Mobile responsive: all new pages work on phone screens
- [ ] Accessibility: badges have aria-labels, reports use semantic headings

## Design Decisions

- **Reports use accordion expansion** on the listing page (not separate page navigation) for quick scanning. The `/reports/[slug]` route exists for direct linking and SEO.
- **Congressional scores use 4 tiers** matching a traffic light pattern: red (critical), orange (high), yellow (medium), gray (low). This is intuitive for non-technical users.
- **Reading paths are static initially** to avoid over-engineering. User-curated paths can be added later as a community feature.
- **Detection badges are small and non-intrusive** — they don't replace existing redaction UI, they augment it with provenance information.

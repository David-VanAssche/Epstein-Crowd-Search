# Phase C: Timeline Tab

## Status: NOT STARTED

## Problem

The "Timeline" tab on the entity detail page renders `EntityTimeline`, which is a pure stub:

```typescript
export function EntityTimeline({ entityId }: EntityTimelineProps) {
  return <ProcessingFundingCard slug="entity-timeline" variant="compact" />
}
```

The data infrastructure already exists:
- `timeline_events` table with `event_date, date_precision, date_display, description, event_type, location, source_chunk_ids, source_document_ids, entity_ids, is_verified`
- The dossier API already queries `timeline_events WHERE entity_ids @> [id]`
- The `TIMELINE_EXTRACT` pipeline stage populates this table from documents
- Event types: `travel, meeting, legal, communication, financial, testimony, arrest, other`

---

## Changes

### 1. Entity Timeline API Route

**New file: `app/api/entity/[id]/timeline/route.ts`**

Dedicated endpoint for entity timeline events:

```
GET /api/entity/{id}/timeline?event_type=travel&limit=100&offset=0
```

Query:
```sql
SELECT
  te.id, te.event_date, te.date_precision, te.date_display,
  te.description, te.event_type, te.location,
  te.source_document_ids, te.entity_ids, te.is_verified
FROM timeline_events te
WHERE te.entity_ids @> ARRAY[$1]::uuid[]
ORDER BY te.event_date ASC NULLS LAST
LIMIT $limit OFFSET $offset
```

Additional queries:
- Resolve `entity_ids` to names (batch lookup, skip current entity)
- Resolve `source_document_ids` to filenames (batch lookup, top 3 per event)

Optional filters:
- `event_type` — filter by single type
- `year` — filter to a specific year
- `verified_only=true` — only verified events

Returns array with total count.

### 2. useEntityTimeline Hook

**New file: `lib/hooks/useEntityTimeline.ts`**

```typescript
interface UseEntityTimelineOptions {
  entityId: string
  eventType?: string
  year?: number
  limit?: number
}

export function useEntityTimeline(options: UseEntityTimelineOptions) {
  return useQuery({
    queryKey: ['entity-timeline', options],
    queryFn: () => fetchApi<TimelineResponse>(url),
    staleTime: 60_000,
  })
}
```

### 3. EntityTimeline Component Rewrite

**Modified: `components/entity/EntityTimeline.tsx`**

Replace the stub with a vertical timeline visualization:

```
┌─ Timeline Tab ──────────────────────────────────────────┐
│                                                          │
│  [Filter: All Events ▼]  [Year: All ▼]  42 events       │
│                                                          │
│  2002                                                    │
│  ──┬──                                                   │
│    │  Jan 5, 2002 ──────────────────── travel ──────     │
│    │  Flew from Teterboro to Palm Beach                  │
│    │  with: Ghislaine Maxwell, Sarah Kellen              │
│    │  📍 Palm Beach, FL   📄 flight-log-2002.pdf         │
│    │                                                     │
│    │  Mar 12, 2002 ─────────────────── financial ───     │
│    │  Wire transfer of $250,000 to [REDACTED] account    │
│    │  📍 New York, NY     📄 financial-records.pdf       │
│    │                                                     │
│  2003                                                    │
│  ──┬──                                                   │
│    │  ...                                                │
│                                                          │
│  [Show more events]                                      │
└──────────────────────────────────────────────────────────┘
```

Component structure:
- **Filter bar**: event type dropdown, year selector (populated from data)
- **Year groups**: events grouped by year, with year headers
- **Event nodes**: vertical timeline with dots on a line
  - Header: `date_display` or formatted `event_date` + event_type badge
  - Body: description text
  - Co-entities: "with: Entity1, Entity2" linked to `/entity/{id}`
  - Footer row: location with MapPin icon, source document links
  - Verified events get a checkmark icon
- **Load more**: button to load additional events (or infinite scroll if >100 events)

Event type badge colors:
- `travel` → blue
- `meeting` → purple
- `legal` → red
- `communication` → green
- `financial` → amber
- `testimony` → orange
- `arrest` → red (destructive)
- `other` → gray

### 4. Timeline Event Type Interface

**New in `types/entities.ts`** (or in a new `types/timeline.ts`):

```typescript
export interface TimelineEvent {
  id: string
  event_date: string | null
  date_precision: 'exact' | 'month' | 'year' | 'approximate'
  date_display: string | null
  description: string
  event_type: 'travel' | 'meeting' | 'legal' | 'communication' | 'financial' | 'testimony' | 'arrest' | 'other'
  location: string | null
  is_verified: boolean
  co_entities: Array<{ id: string; name: string; type: string }>
  source_documents: Array<{ id: string; filename: string }>
}

export interface TimelineResponse {
  events: TimelineEvent[]
  total: number
  years: number[]  // sorted list of years with events, for filter
}
```

---

## Files Summary

| File | Action | Description |
|------|--------|-------------|
| `app/api/entity/[id]/timeline/route.ts` | NEW | Timeline events API |
| `lib/hooks/useEntityTimeline.ts` | NEW | React Query hook |
| `types/timeline.ts` | NEW | TimelineEvent, TimelineResponse |
| `components/entity/EntityTimeline.tsx` | REWRITE | Vertical timeline visualization |

## Dependencies

- Data must exist in `timeline_events` table (requires pipeline processing)
- Independent of Phases A and B

## Estimated Effort

Small-medium. 4 files. The timeline visualization is the main design work — the data flow is straightforward.

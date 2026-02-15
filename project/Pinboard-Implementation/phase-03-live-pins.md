# Phase 3: Live Data Pins + Detail Panel

## Goal

Transform pins from static labels into live windows into the archive. When you pin an entity,
you see its real-time stats. When you pin a redaction, you see its current status and
proposals. A right sidebar shows full detail for the selected pin.

## Status: NOT STARTED

## Dependencies: Phase 2 complete

---

## Step 3.1: Pin Data Enrichment API

**File:** `app/api/pinboard/[boardId]/enriched/route.ts`

Single endpoint that takes a board's pins and returns enriched data for each:

```
GET /api/pinboard/:boardId/enriched
```

Returns a map of `pin_id → enriched_data` where enriched data depends on pin type:

| Pin Type | Enriched Fields |
|----------|----------------|
| `entity` | `mention_count`, `relationship_count`, `document_count`, `entity_type`, `flight_count`, `network_centrality` |
| `document` | `page_count`, `chunk_count`, `redaction_count`, `unsolved_redactions`, `entity_count`, `dataset_name` |
| `redaction` | `status`, `proposal_count`, `top_confidence`, `char_length_estimate`, `redaction_type`, `surrounding_text` |
| `flight` | `date`, `origin`, `destination`, `passenger_count`, `aircraft` |
| `financial` | `amount`, `currency`, `date`, `parties`, `is_suspicious` |
| `timeline_event` | `event_date`, `event_type`, `entity_names` |
| `contradiction` | `severity`, `status`, `vote_count` |
| `image` | `thumbnail_url`, `dimensions`, `document_filename` |
| `note` | (no enrichment needed) |
| `external_link` | (no enrichment needed) |

### SQL Function

**File:** `supabase/migrations/00030_pinboard_functions.sql` (or next available number)

```sql
CREATE FUNCTION enrich_pins(p_pin_ids UUID[], p_pin_types TEXT[], p_target_ids UUID[])
RETURNS JSONB
```

Takes parallel arrays and returns a JSONB object keyed by pin_id. This is a single query
with LEFT JOINs and conditional aggregation — avoids N+1 fetches.

### Checklist
- [ ] SQL enrichment function
- [ ] API route
- [ ] Returns all enriched data in one call
- [ ] Handles missing/deleted targets gracefully (pin still shows, marked as "removed")

---

## Step 3.2: Live Pin Cards

**File:** `components/pinboard/PinItem.tsx` (extend)

Update PinItem to accept and display enriched data:

### Entity Pin Card
```
┌─ [PersonIcon] Entity ──────── [📌] [x] ─┐
│ Ghislaine Maxwell                         │
│ Person                                    │
│ ──────────────────────────────            │
│ 847 docs · 23 flights · 14 connections    │
└───────────────────────────────────────────┘
```

### Document Pin Card
```
┌─ [FileIcon] Document ──────── [📌] [x] ─┐
│ Epstein-Financial-Records-2003.pdf        │
│ Dataset 5 · 47 pages                      │
│ ──────────────────────────────            │
│ 3 redactions unsolved · 12 entities       │
└───────────────────────────────────────────┘
```

### Redaction Pin Card
```
┌─ [EyeOffIcon] Redaction ──── [📌] [x] ─┐
│ "...meeting with [████ ~8 chars████]     │
│  at the residence..."                     │
│ ──────────────────────────────            │
│ proposed · 2 proposals · 65% top conf.    │
└───────────────────────────────────────────┘
```

### Data Freshness

Enriched data is fetched when:
1. Board first loads
2. User clicks "Refresh" button in toolbar
3. Background polling every 60s (only for active board tab)

Use `useQuery` with `staleTime: 60_000` and `refetchInterval: 60_000`.

### Checklist
- [ ] Entity pin shows mention/doc/flight/connection counts
- [ ] Document pin shows page count, redaction count, entities
- [ ] Redaction pin shows status, proposals, top confidence
- [ ] Flight pin shows route, date, passengers
- [ ] Financial pin shows amount, date, suspicion flag
- [ ] Graceful handling when target item has been deleted
- [ ] Loading skeleton while enrichment data loads

---

## Step 3.3: Detail Sidebar

**File:** `components/pinboard/PinDetailSidebar.tsx`

When a pin is selected (clicked, not dragged), a right sidebar slides in showing full detail:

### Layout
```
┌──────── Pin Detail ──── [Open ↗] [x] ─┐
│                                         │
│ [Full entity/document/redaction detail]  │
│                                         │
│ ── On This Board ──────────────────     │
│ Also appears in: Pin "Flight Record     │
│ 2003-03-14" (draw connection?)          │
│                                         │
│ ── Related Items ──────────────────     │
│ 5 entities on this board share docs     │
│ with this entity (show list)            │
│                                         │
│ ── Notes ──────────────────────────     │
│ [Editable note textarea]                │
│                                         │
└─────────────────────────────────────────┘
```

### Per-Type Detail Panels

| Type | Detail content |
|------|---------------|
| `entity` | Full entity card: type, aliases, mention count, top documents, relationships to other pinned entities |
| `document` | Filename, dataset, page count, list of entities found, redaction summary, link to viewer |
| `redaction` | Surrounding text, sentence template, all proposals with vote counts, char estimate |
| `flight` | Full manifest, date, aircraft, origin/destination, all passengers (highlight pinned ones) |
| `note` | Just the note text in an editable area |

### "Open" Button

Top-right button opens the actual item's page in a new tab:
- Entity → `/entity/{id}`
- Document → `/document/{id}`
- Redaction → `/redactions` (scrolled to this one — future: `/redaction/{id}`)
- Flight → `/flights` (future: `/flight/{id}`)

### Checklist
- [ ] Sidebar component with slide-in animation
- [ ] Entity detail panel
- [ ] Document detail panel
- [ ] Redaction detail panel
- [ ] Note editing in sidebar
- [ ] "Open in new tab" button
- [ ] "Related items on this board" section
- [ ] Close on Escape key

---

## Step 3.4: Cross-Pin Highlighting

When a pin is selected, highlight other pins that are related:

- Select an entity → highlight documents that mention it
- Select a document → highlight entities found in it
- Select a flight → highlight entities who were passengers

This requires the enrichment data to include cross-references. The enrichment endpoint
should return a `related_target_ids: string[]` field for each pin — the set of target_ids
from other pin types that this pin relates to. The canvas then highlights pins whose
`target_id` is in that set.

### Checklist
- [ ] Enrichment returns `related_target_ids`
- [ ] Canvas highlights related pins when one is selected
- [ ] Highlight with glowing border or increased opacity
- [ ] Connections between highlighted pins pulse or thicken

---

## Verification

1. Pin an entity → see live mention count, doc count, flight count
2. Pin a document with redactions → see redaction count, unsolved count
3. Select an entity pin → sidebar shows full detail → "Open" goes to entity page
4. Select entity → documents mentioning that entity glow on the board
5. Delete an entity from the DB → pinned card shows "(Deleted)" gracefully
6. Performance: 50 pins enriched in <500ms

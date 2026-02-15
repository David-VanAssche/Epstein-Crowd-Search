# Phase 4: AI Suggestions + Auto-Layout

## Goal

The AI layer turns the pinboard from a manual organization tool into an active investigation
assistant. It surfaces connections you haven't noticed, identifies gaps in your evidence, and
can auto-arrange pins based on data relationships.

## Status: NOT STARTED

## Dependencies: Phase 3 complete

---

## Step 4.1: "Did You Know?" Connection Suggestions

When a board has 2+ entity pins, check for data-backed relationships between them that the
user hasn't manually connected.

### API Endpoint

**File:** `app/api/pinboard/[boardId]/suggestions/route.ts`

```
GET /api/pinboard/:boardId/suggestions
```

Returns:
```typescript
interface BoardSuggestion {
  type: 'connection' | 'missing_entity' | 'unsolved_redaction' | 'temporal_cluster'
  priority: 'high' | 'medium' | 'low'
  title: string
  description: string
  // For connection suggestions:
  from_pin_id?: string
  to_pin_id?: string
  relationship_type?: string
  evidence_count?: number
  // For missing entity suggestions:
  entity_id?: string
  entity_name?: string
  shared_document_count?: number
  // For redaction suggestions:
  redaction_id?: string
  candidate_entity_ids?: string[]  // pinned entities that might fill this redaction
}
```

### Suggestion Types

**Connection suggestions** — Two pinned entities that:
- Co-occur in N+ documents (from `entity_mentions`)
- Share flight records (from `flight_logs` / `flight_passengers`)
- Have a direct relationship in `entity_relationships`
- Have temporal proximity of events (from `timeline_events`)

Query: For all pairs of pinned entities, check `entity_relationships` and co-occurrence.

**Missing entity suggestions** — An entity NOT on the board that:
- Appears in 3+ documents that ARE pinned
- Has relationships with 2+ pinned entities
- Is a high-centrality node connected to pinned entities

Query: From pinned document IDs, find entities that appear in multiple pinned docs but aren't pinned.

**Redaction suggestions** — An unsolved redaction where:
- The document is pinned, OR
- A pinned entity is a candidate (matches char_length_estimate, context)
- The redaction's `co_occurring_entity_ids` overlap with pinned entities

Query: From pinned entity IDs and document IDs, find redactions that could benefit.

**Temporal clusters** — Events involving pinned entities that cluster in a narrow time window.
"3 pinned entities all have events within the same 7-day window in March 2003."

### SQL Functions

**File:** `supabase/migrations/00031_pinboard_ai.sql` (or next available)

```sql
-- Find data-backed connections between a set of entity IDs
CREATE FUNCTION find_entity_pair_evidence(entity_ids UUID[])
RETURNS TABLE (
  entity_a UUID, entity_b UUID,
  co_document_count INT, co_flight_count INT,
  has_direct_relationship BOOLEAN,
  relationship_types TEXT[]
)

-- Find entities missing from a board
CREATE FUNCTION find_missing_board_entities(
  pinned_entity_ids UUID[],
  pinned_document_ids UUID[],
  min_overlap INT DEFAULT 3
)
RETURNS TABLE (
  entity_id UUID, entity_name TEXT, entity_type TEXT,
  shared_document_count INT, relationship_count INT
)

-- Find redaction candidates from pinned entities
CREATE FUNCTION find_board_redaction_candidates(
  pinned_entity_ids UUID[],
  pinned_document_ids UUID[]
)
RETURNS TABLE (
  redaction_id UUID, document_id UUID,
  char_length_estimate INT, surrounding_text TEXT,
  candidate_entity_ids UUID[]
)
```

### UI: Suggestions Panel

**File:** `components/pinboard/SuggestionsPanel.tsx`

A collapsible panel on the right side (below or instead of detail panel when no pin selected):

```
┌─── Board Insights ─────────────────────┐
│                                         │
│ 🔗 3 suggested connections              │
│                                         │
│ "Maxwell and Person B appear together   │
│  in 12 documents"                       │
│  [Add Connection] [Dismiss]             │
│                                         │
│ 👤 2 entities you might be missing      │
│                                         │
│ "Entity C appears in 4 of your pinned   │
│  documents but isn't on your board"     │
│  [Pin Entity C] [Dismiss]              │
│                                         │
│ 🔍 1 redaction you could solve          │
│                                         │
│ "Document X p.47 has a [████ 8 chars]   │
│  redaction — Entity D (on your board)   │
│  fits the context"                      │
│  [Pin Redaction] [Open Redaction]       │
│                                         │
└─────────────────────────────────────────┘
```

"Add Connection" creates a `data_backed` connection and refreshes.
"Pin Entity C" adds a pin and refreshes suggestions.
"Dismiss" hides that suggestion for this board (store dismissed suggestion IDs in board metadata).

### Checklist
- [ ] SQL functions for pair evidence, missing entities, redaction candidates
- [ ] Suggestions API endpoint
- [ ] SuggestionsPanel UI component
- [ ] "Add Connection" action
- [ ] "Pin missing entity" action
- [ ] "Dismiss" persistence
- [ ] Refresh suggestions when pins change
- [ ] Rate limit suggestion computation (cache for 5 minutes)

---

## Step 4.2: Auto-Layout Algorithms

**File:** `lib/pinboard/layout.ts`

Users can click "Auto-Layout" to rearrange pins algorithmically. Offer multiple modes:

### Layout Modes

| Mode | Algorithm | Best for |
|------|-----------|----------|
| **Force-directed** | Spring simulation based on connections + data relationships | General purpose, shows clusters |
| **Timeline** | X-axis = time, Y-axis = entity | Temporal investigations |
| **Cluster** | Group by document co-occurrence | Finding document-based patterns |
| **Radial** | Selected pin at center, others by relationship distance | Focused on one entity |

### Force-Directed Layout

Use a simple force simulation (no heavy library needed):
- **Attractive force** between connected pins (spring)
- **Attractive force** between pins that share documents (weaker spring)
- **Repulsive force** between all pins (prevent overlap)
- **Gravity** toward center (prevent drift)

Run 100-200 iterations, animate the transition.

```typescript
export function forceDirectedLayout(
  pins: Pin[],
  connections: PinConnection[],
  coOccurrenceMatrix: Map<string, Set<string>>,  // pin pairs that share data
): Map<string, { x: number; y: number }>
```

### Timeline Layout

- X-axis: earliest associated date (from enrichment data)
- Y-axis: group by entity / document / manually
- Pins without dates stacked at the right edge

### Checklist
- [ ] Force-directed layout algorithm
- [ ] Timeline layout algorithm
- [ ] Layout mode selector in toolbar
- [ ] Animated transition between layouts
- [ ] "Undo layout" (restore previous positions)
- [ ] Layout preserves section groupings when possible

---

## Step 4.3: Redaction Workspace Mode

When a board has 1+ redaction pins, offer a specialized "Redaction Workspace" mode:

**File:** `components/pinboard/RedactionWorkspace.tsx`

Shows the redaction context with candidate entities from the board:

```
┌─────────────────────────────────────────────────────┐
│ Redaction: "...meeting with [████ ~8 chars████]     │
│  at the residence on March 14..."                   │
│                                                     │
│ Entities on your board that fit:                     │
│                                                     │
│ ✅ "Person D" (8 chars) — appears in 3 nearby docs  │
│ ⚠️ "Person E" (7 chars) — appears in 1 nearby doc   │
│ ❌ "Organization F" (14 chars) — too long            │
│                                                     │
│ [Propose "Person D"] [Propose "Person E"]            │
└─────────────────────────────────────────────────────┘
```

Filters pinned entities by:
1. `char_length_estimate` match (±3)
2. `redaction_type` match (name → entities of type person/org)
3. Context similarity (if embeddings available)
4. Co-occurring entity overlap

"Propose" opens the ProposalForm pre-filled with the entity name and auto-generated evidence
description referencing the board.

### Checklist
- [ ] RedactionWorkspace component
- [ ] Entity filtering by char length and type
- [ ] Context scoring against pinned entities
- [ ] Pre-filled proposal form
- [ ] Integration with existing proposal submission flow

---

## Verification

1. Pin 5 entities → suggestions panel shows data-backed connections between them
2. "Missing entity" suggestion appears for entity in multiple pinned documents
3. Accept a connection suggestion → connection appears on canvas as dashed line (data-backed)
4. Auto-layout: force-directed produces reasonable clustering of related entities
5. Auto-layout: timeline mode arranges pins chronologically
6. Redaction workspace correctly filters entities by char length
7. Performance: suggestions compute in <2s for a board with 30 pins

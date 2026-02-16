# Phase 1: Foundation — Database, API, Basic CRUD

## Goal

Replace the hardcoded empty-state pinboard with a working system: users can create boards,
add/remove/reposition pins, draw connections, and everything persists to the database.

## Status: NOT STARTED

---

## Step 1.1: Database Migration

**File:** `supabase/migrations/00029_pinboard_tables.sql`

### Tables

```sql
-- Boards (one per user investigation)
CREATE TABLE pin_boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled Board',
  description TEXT,
  visibility TEXT NOT NULL DEFAULT 'private',  -- 'private' | 'published' | 'anonymous'
  fork_source_id UUID REFERENCES pin_boards(id) ON DELETE SET NULL,
  viewport JSONB DEFAULT '{"x": 0, "y": 0, "zoom": 1}',  -- saved camera position
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Individual pins on a board
CREATE TABLE pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES pin_boards(id) ON DELETE CASCADE,
  pin_type TEXT NOT NULL,  -- see Pin Types below
  target_id UUID,          -- references the archive item (nullable for notes)
  label TEXT NOT NULL,
  note TEXT,               -- user annotation on the pin
  color TEXT,              -- optional override of type-default color
  position_x FLOAT NOT NULL DEFAULT 0,
  position_y FLOAT NOT NULL DEFAULT 0,
  width FLOAT,             -- optional custom size
  height FLOAT,
  section_id UUID REFERENCES pin_sections(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Connections (edges between pins)
CREATE TABLE pin_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES pin_boards(id) ON DELETE CASCADE,
  from_pin_id UUID NOT NULL REFERENCES pins(id) ON DELETE CASCADE,
  to_pin_id UUID NOT NULL REFERENCES pins(id) ON DELETE CASCADE,
  label TEXT,
  connection_type TEXT DEFAULT 'manual',  -- 'manual' | 'ai_suggested' | 'data_backed'
  source_relationship_id UUID,  -- optional FK to entity_relationships if data-backed
  created_at TIMESTAMPTZ DEFAULT now(),
  CHECK (from_pin_id != to_pin_id)
);

-- Optional grouping rectangles
CREATE TABLE pin_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES pin_boards(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  color TEXT DEFAULT '#1e293b',
  position_x FLOAT NOT NULL DEFAULT 0,
  position_y FLOAT NOT NULL DEFAULT 0,
  width FLOAT NOT NULL DEFAULT 400,
  height FLOAT NOT NULL DEFAULT 300,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Note:** Create `pin_sections` before `pins` so the FK works, or use ALTER TABLE.

### Pin Types

| pin_type | target_id references | Description |
|----------|---------------------|-------------|
| `document` | `documents.id` | A specific document |
| `document_page` | `documents.id` | A specific page (store page number in note or metadata) |
| `entity` | `entities.id` | A person, org, location, etc. |
| `redaction` | `redactions.id` | An unsolved/proposed redaction |
| `flight` | `flight_logs.id` | A flight record |
| `financial` | `financial_transactions.id` | A financial transaction |
| `timeline_event` | `timeline_events.id` | A dated event |
| `contradiction` | `contradictions.id` | A flagged contradiction |
| `image` | `images.id` | An image from the archive |
| `note` | NULL | Freeform text note |
| `external_link` | NULL | External URL (stored in note) |

### RLS Policies

```sql
-- Boards: owner can CRUD, published boards are publicly readable
ALTER TABLE pin_boards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner full access" ON pin_boards
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Published boards are readable" ON pin_boards
  FOR SELECT USING (visibility IN ('published', 'anonymous'));

-- Pins/connections/sections: access follows board ownership
-- Use SECURITY DEFINER helper function to check board ownership
```

### Indexes

```sql
CREATE INDEX idx_pins_board ON pins (board_id);
CREATE INDEX idx_pins_target ON pins (target_id) WHERE target_id IS NOT NULL;
CREATE INDEX idx_pin_connections_board ON pin_connections (board_id);
CREATE INDEX idx_pin_boards_user ON pin_boards (user_id);
CREATE INDEX idx_pin_boards_visibility ON pin_boards (visibility) WHERE visibility != 'private';
```

### Checklist
- [ ] Write migration file
- [ ] Run locally and verify schema
- [ ] Verify RLS: owner can CRUD, anon cannot, published boards readable

---

## Step 1.2: TypeScript Types

**File:** `types/pinboard.ts` (new file — separate from `collaboration.ts`)

Replace the inline interfaces in `PinboardCanvas.tsx`, `PinItem.tsx`, and `page.tsx` with
proper shared types that match the DB schema.

```typescript
export type PinType =
  | 'document' | 'document_page' | 'entity' | 'redaction'
  | 'flight' | 'financial' | 'timeline_event' | 'contradiction'
  | 'image' | 'note' | 'external_link'

export type BoardVisibility = 'private' | 'published' | 'anonymous'
export type ConnectionType = 'manual' | 'ai_suggested' | 'data_backed'

export interface Board { ... }
export interface Pin { ... }
export interface PinConnection { ... }
export interface PinSection { ... }
```

Deprecate `PinboardBoard`, `PinboardPin`, `PinboardConnection` from `types/collaboration.ts`
(mark as `@deprecated` but don't delete yet — may have consumers).

### Checklist
- [ ] Create `types/pinboard.ts`
- [ ] Deprecate old types in `collaboration.ts`
- [ ] Update existing components to import from new types file

---

## Step 1.3: API Routes

### Board CRUD

**File:** `app/api/pinboard/route.ts`
- `GET /api/pinboard` — list user's boards (requires auth)
- `POST /api/pinboard` — create new board

**File:** `app/api/pinboard/[boardId]/route.ts`
- `GET /api/pinboard/:boardId` — get board with all pins, connections, sections
- `PATCH /api/pinboard/:boardId` — update board metadata (title, description, visibility)
- `DELETE /api/pinboard/:boardId` — delete board

### Pin CRUD

**File:** `app/api/pinboard/[boardId]/pins/route.ts`
- `POST /api/pinboard/:boardId/pins` — add pin(s) to board (batch-capable)

**File:** `app/api/pinboard/[boardId]/pins/[pinId]/route.ts`
- `PATCH /api/pinboard/:boardId/pins/:pinId` — update position, note, label
- `DELETE /api/pinboard/:boardId/pins/:pinId` — remove pin

### Batch Position Update

**File:** `app/api/pinboard/[boardId]/layout/route.ts`
- `PATCH /api/pinboard/:boardId/layout` — batch update pin positions
  (after drag operations, send all changed positions at once, not one per pin)

### Connection CRUD

**File:** `app/api/pinboard/[boardId]/connections/route.ts`
- `POST /api/pinboard/:boardId/connections` — create connection
- `DELETE` via query param or in body

### Zod Schemas

**File:** `lib/api/schemas.ts` (add to existing)

```typescript
export const createBoardSchema = z.object({
  title: z.string().min(1).max(200).default('Untitled Board'),
  description: z.string().max(2000).optional(),
})

export const addPinSchema = z.object({
  pin_type: z.enum([...PIN_TYPES]),
  target_id: z.string().uuid().optional(),
  label: z.string().min(1).max(500),
  note: z.string().max(5000).optional(),
  position_x: z.number().default(0),
  position_y: z.number().default(0),
})

export const batchPositionSchema = z.object({
  positions: z.array(z.object({
    pin_id: z.string().uuid(),
    x: z.number(),
    y: z.number(),
  })).max(500),
})
```

### Checklist
- [ ] Board CRUD routes
- [ ] Pin CRUD routes
- [ ] Batch layout route
- [ ] Connection CRUD routes
- [ ] Zod schemas
- [ ] Test with curl / integration tests

---

## Step 1.4: React Query Hooks

**File:** `lib/hooks/usePinboard.ts`

```typescript
export function useBoards()                    // list user's boards
export function useBoard(boardId: string)      // single board + pins + connections
export function useCreateBoard()               // mutation
export function useDeleteBoard()               // mutation
export function useAddPin(boardId: string)     // mutation
export function useRemovePin(boardId: string)  // mutation
export function useUpdatePinPosition()         // debounced batch position update
export function useAddConnection()             // mutation
export function useRemoveConnection()          // mutation
```

The position update hook is critical — it needs to debounce (collect position changes during
drag operations, flush on mouseup) and batch them into a single API call.

### Checklist
- [ ] All hooks created
- [ ] Debounced position updates working
- [ ] Proper cache invalidation on mutations

---

## Step 1.5: Rewrite Pinboard Page

**File:** `app/(auth)/pinboard/page.tsx`

Replace the hardcoded scaffold:

1. Fetch boards via `useBoards()`
2. Show board list sidebar (or create first board)
3. Load selected board via `useBoard(boardId)`
4. Pass real data to `PinboardCanvas`
5. Wire up AddPinDialog to actually create pins via API
6. Save positions on drag-end via batch API

At this point the page should work end-to-end: create board → add pin (note only) → drag
it around → reload page → pin is where you left it.

### Checklist
- [ ] Board creation/selection works
- [ ] Pins persist after page reload
- [ ] Connections persist
- [ ] Delete pin/board works
- [ ] Empty state still shows for users with no boards

---

## Verification

1. Create a board, add 5 note pins, draw 3 connections, reload — everything persists
2. Drag pins around, reload — positions saved
3. Second user cannot see first user's private boards
4. Delete a board — all pins and connections cascade-deleted
5. `pnpm tsc --noEmit` passes
6. Existing tests still pass

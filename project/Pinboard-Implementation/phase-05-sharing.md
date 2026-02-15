# Phase 5: Publish, Fork, Export

## Goal

Let users share their investigation findings publicly (or anonymously) and let others build
on that work by forking boards. Export for offline use, publication, or legal proceedings.

## Status: NOT STARTED

## Dependencies: Phase 3 complete (Phase 4 is independent/parallel)

---

## Step 5.1: Publish Flow

### Board Visibility Settings

**File:** Update board PATCH endpoint and add UI controls

When a user clicks "Publish" on a private board:

1. **Confirmation dialog** — "Publishing makes this board visible to everyone. Your username
   will be shown as the author unless you choose anonymous."
2. **Visibility options:**
   - **Published** — Board is read-only to the public, attributed to the user
   - **Anonymous** — Board is read-only to the public, author shown as "Anonymous Researcher"
3. **Snapshot behavior** — Publishing creates a point-in-time snapshot. The owner can continue
   editing, but the public sees the version at publish time. Re-publish to update.

Actually, for simplicity in v1: publishing just flips the `visibility` flag. The public sees
the live board state (read-only). Snapshot versioning is a future enhancement.

### Published Board Page

**File:** `app/(public)/pinboard/[boardId]/page.tsx`

Public route (no auth required) that shows a read-only version of a published board:
- All pins visible with enriched data
- Connections visible
- No drag, no editing
- "Fork this board" button (requires auth)
- Author name (or "Anonymous Researcher")
- Created/updated dates
- Pin count, connection count

### Checklist
- [ ] Publish confirmation dialog
- [ ] Visibility toggle (private/published/anonymous)
- [ ] Public read-only board page
- [ ] Hide author name for anonymous boards
- [ ] "Unpublish" option to revert to private
- [ ] Published boards appear in a browsable gallery (future, just the route for now)

---

## Step 5.2: Fork Flow

When viewing a published board, users can fork it:

1. Click "Fork to My Boards"
2. System creates a new private board owned by the forking user:
   - Copies all pins, connections, sections
   - Sets `fork_source_id` to the original board
   - Title: "Fork of {original title}"
3. The forked board is fully independent — edits don't affect the original
4. Show "Forked from {author}'s {board name}" attribution on the forked board

### API

**File:** `app/api/pinboard/[boardId]/fork/route.ts`

```
POST /api/pinboard/:boardId/fork
Auth: required
Body: { title?: string }  // optional custom title
```

### SQL Function

```sql
CREATE FUNCTION fork_board(p_source_board_id UUID, p_new_owner_id UUID, p_title TEXT)
RETURNS UUID  -- new board ID
```

Single SQL function that copies board + all pins + all connections in one transaction.

### Checklist
- [ ] Fork API endpoint
- [ ] Fork SQL function (atomic copy)
- [ ] "Fork" button on published board page
- [ ] Fork attribution shown on forked board
- [ ] Fork count shown on source board

---

## Step 5.3: Export

### Export Formats

| Format | Use case | Content |
|--------|----------|---------|
| **PNG/SVG** | Sharing on social media, presentations | Visual snapshot of canvas |
| **PDF** | Legal proceedings, academic papers | Canvas + pin details + sources |
| **JSON** | Data portability, backup | Full board data structure |
| **Markdown** | Blog posts, reports | Structured text with links |

### PNG/SVG Export

**File:** `lib/pinboard/export.ts`

Use `html-to-image` (or similar) to capture the canvas div as PNG/SVG.
- Render at 2x resolution for retina
- Include board title as header
- Include legend of pin types
- Optionally include connection labels

### PDF Export

Generate a multi-section PDF:
1. **Canvas snapshot** — the visual board layout
2. **Pin inventory** — table of all pins with type, label, link to source
3. **Connections** — table of all connections with labels
4. **Evidence chain** — for each connection, the underlying data (documents, co-occurrences)

Use `@react-pdf/renderer` or generate server-side with `puppeteer` (heavier).

### JSON Export

Straightforward dump of board + pins + connections + enriched data.
Include archive URLs so pins can be re-linked if the board is imported elsewhere.

### Markdown Export

```markdown
# Maxwell Network Investigation

## Entities
- **Ghislaine Maxwell** — 847 document mentions, 23 flights
  - Connected to: Person B (12 shared documents), Person C (3 flights)
- **Person B** — 234 document mentions

## Key Documents
- Epstein-Financial-Records-2003.pdf — 3 unsolved redactions
  - Mentions: Maxwell, Person B

## Connections
- Maxwell ↔ Person B: 12 shared documents, 2 shared flights
- ...

## Notes
- "The March 2003 cluster is suspicious — 5 events in 7 days"
```

### Checklist
- [ ] PNG export with html-to-image
- [ ] SVG export
- [ ] JSON export (full data dump)
- [ ] Markdown export (structured summary)
- [ ] PDF export (canvas + details)
- [ ] Export button in toolbar with format picker
- [ ] File naming: `{board-title}-{date}.{format}`

---

## Step 5.4: Board Discovery (Lightweight)

Not a full social feature — just enough to make published boards findable:

**File:** `app/(public)/pinboard/page.tsx`

A public page listing recently published boards:
- Sorted by most recently updated
- Shows: title, author (or "Anonymous"), pin count, fork count, updated date
- Click to open read-only view
- Search/filter by title text

### API

```
GET /api/pinboard/public?page=1&per_page=20&search=maxwell
```

Returns published and anonymous boards (not private).

### Checklist
- [ ] Public board listing page
- [ ] API endpoint for public boards
- [ ] Search by title
- [ ] Sort by recency/fork count
- [ ] Link from main navigation

---

## Verification

1. Publish a board → accessible at public URL without auth
2. Anonymous publish → author name not shown
3. Fork a board → new private copy with all pins and connections
4. Export PNG → readable image with all pins visible
5. Export JSON → re-importable (future)
6. Export Markdown → well-structured document with all key info
7. Published boards appear in public listing
8. Unpublish → board no longer accessible at public URL

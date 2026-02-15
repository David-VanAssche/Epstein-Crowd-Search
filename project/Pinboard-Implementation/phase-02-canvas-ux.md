# Phase 2: Canvas UX — Rewrite + Pin From Anywhere

## Goal

Upgrade the canvas from a basic drag prototype to a polished spatial workspace, and add the
"Pin to Board" button throughout the entire app so boards accumulate content organically as
users browse.

## Status: NOT STARTED

## Dependencies: Phase 1 complete

---

## Step 2.1: Canvas Engine Upgrade

**File:** `components/pinboard/PinboardCanvas.tsx` (rewrite)

The current canvas uses raw `mousemove` events and absolute positioning. This works for a
demo but breaks at scale (100+ pins, pan/zoom edge cases, touch support). Replace with a
purpose-built approach:

### Option A: Build on `@use-gesture/react` + CSS transforms
- Lighter weight, keeps us in React-land
- Pan via drag on background, zoom via wheel/pinch
- Pin dragging via `useDrag` from use-gesture
- SVG layer for connections (lines/arrows)
- Good for up to ~200-300 pins

### Option B: Use `reactflow` / `@xyflow/react`
- Purpose-built for node-and-edge graphs
- Built-in minimap, controls, pan/zoom, connection drawing
- Heavier dependency (~50KB gzipped) but battle-tested
- Handles 1000+ nodes
- Risk: may be over-opinionated for our "evidence board" aesthetic

### Recommendation: Option A for now
React Flow is great but its node paradigm might fight our "corkboard" aesthetic. We can
always migrate later if pin counts get high. Use `@use-gesture/react` (already a common
dependency in shadcn ecosystems).

### Canvas Features

| Feature | Priority | Notes |
|---------|----------|-------|
| Pan (drag background) | P0 | Shift+drag or middle-click |
| Zoom (wheel/pinch) | P0 | Min 0.1x, max 4x, zoom to cursor |
| Pin drag | P0 | Snap to grid (optional, toggle) |
| Rubber-band selection | P1 | Drag to select multiple pins, move as group |
| Connection drawing | P0 | Drag from pin handle to another pin |
| Connection deletion | P0 | Click connection → delete button |
| Minimap | P1 | Fixed corner, shows all pins as dots |
| Fit-to-content | P1 | Button that auto-zooms to show all pins |
| Keyboard shortcuts | P2 | Delete=remove, Ctrl+A=select all, Space=pan |
| Touch support | P2 | Pinch zoom, touch drag |

### Checklist
- [ ] Install `@use-gesture/react` if not present
- [ ] Implement pan/zoom transform layer
- [ ] Pin drag with optional grid snap
- [ ] SVG connection lines with labels
- [ ] Connection drawing (drag from handle)
- [ ] Minimap overlay
- [ ] Fit-to-content button
- [ ] Keyboard shortcuts

---

## Step 2.2: Pin Type Visual Design

**File:** `components/pinboard/PinItem.tsx` (rewrite)

Each pin type should be visually distinct at a glance:

| Pin Type | Color | Icon | Content Preview |
|----------|-------|------|----------------|
| `document` | Blue border | `FileText` | Filename, page count, dataset |
| `document_page` | Blue border, page badge | `File` | Filename + page number |
| `entity` | Purple border | Entity type icon | Name, type, mention count |
| `redaction` | Red border | `EyeOff` | Surrounding text, status |
| `flight` | Cyan border | `Plane` | Date, route, passengers |
| `financial` | Green border | `DollarSign` | Amount, date, parties |
| `timeline_event` | Amber border | `Clock` | Date, description |
| `contradiction` | Orange border | `AlertTriangle` | Severity, claims |
| `image` | Teal border | Thumbnail | Image thumbnail |
| `note` | Gray border | `StickyNote` | User text |
| `external_link` | Slate border | `ExternalLink` | URL, title |

### Pin Card Layout (compact, ~200px wide)
```
┌─ [Icon] [Type Badge] ─────── [Connect] [x] ─┐
│ Title / Name                                   │
│ Subtitle (type-specific detail)                │
│ ─────────────────────────────                  │
│ [Live stat] [Live stat] [Live stat]            │
└────────────────────────────────────────────────┘
```

The live stats row is populated in Phase 3. For now, show static data from the pin record.

### Pin Expanded State
Clicking a pin (not dragging) selects it and opens the right sidebar detail panel (Phase 3).
Double-clicking opens the actual item page in a new tab.

### Checklist
- [ ] Visual design for all 11 pin types
- [ ] Type-colored borders and icons
- [ ] Compact card layout
- [ ] Select state (highlight border)
- [ ] Double-click to open source

---

## Step 2.3: "Pin to Board" Global Action

This is the killer UX feature. Every entity card, document result, flight record, and
redaction card across the entire app gets a pin button.

### Global Context Provider

**File:** `components/pinboard/PinToBoardProvider.tsx`

```typescript
// Wraps the app in layout.tsx
<PinToBoardProvider>
  {children}
</PinToBoardProvider>
```

Provides:
```typescript
interface PinToBoardContext {
  pinToBoard: (item: PinCandidate) => void  // opens the board picker
  boards: Board[]                           // user's boards (cached)
  isOpen: boolean
}

interface PinCandidate {
  pin_type: PinType
  target_id: string
  label: string
  note?: string
}
```

### Board Picker Popover

**File:** `components/pinboard/BoardPicker.tsx`

When `pinToBoard()` is called, a popover/dialog appears:
1. Shows user's boards (most recently updated first)
2. "New Board" option at top
3. Click a board → pin is added → toast "Pinned to {board name}"
4. If user is not authenticated, show sign-in prompt

### Pin Button Component

**File:** `components/pinboard/PinButton.tsx`

```typescript
// Reusable button that any card/page can include
<PinButton
  pinType="entity"
  targetId={entity.id}
  label={entity.name}
/>
```

Renders as a small pin icon button. On click, calls `pinToBoard()` from context.

### Integration Points

Add `<PinButton>` to:

| Component | Pin type | Label |
|-----------|----------|-------|
| Entity cards (search results, graph nodes) | `entity` | Entity name |
| Document cards (search results) | `document` | Filename |
| Document viewer page (per-page) | `document_page` | Filename + page |
| Solvable redaction cards | `redaction` | "Redaction in {doc}" |
| Flight record rows | `flight` | "Flight {date}" |
| Financial transaction rows | `financial` | "Transaction {amount}" |
| Timeline event cards | `timeline_event` | Event description |
| Contradiction cards | `contradiction` | "Contradiction: {summary}" |
| Image viewer | `image` | Image filename |

### Checklist
- [ ] PinToBoardProvider created and added to layout
- [ ] BoardPicker dialog
- [ ] PinButton component
- [ ] Integrated into entity cards
- [ ] Integrated into document cards
- [ ] Integrated into redaction cards
- [ ] Integrated into at least 3 more item types
- [ ] Toast feedback on pin
- [ ] Auth gate (redirect if not signed in)

---

## Step 2.4: Section Groups

**File:** `components/pinboard/SectionRect.tsx`

Dashed-border rectangles that visually group pins. Draggable, resizable, titled.

- Pins inside a section's bounds are loosely associated (via `section_id` FK)
- Moving a section moves its contained pins
- Deleting a section does NOT delete its pins (just orphans them)
- Colors customizable via right-click menu

### Checklist
- [ ] SectionRect component
- [ ] Drag to create section (toolbar button + canvas drag)
- [ ] Resize handles
- [ ] Section title editable
- [ ] Pins snap into/out of sections
- [ ] Moving section moves contained pins

---

## Step 2.5: Board List Sidebar

**File:** `components/pinboard/BoardSidebar.tsx`

Left sidebar on the pinboard page:

```
┌─────────────────────────┐
│ My Boards          [+]  │
│ ─────────────────────── │
│ 📌 Maxwell Network      │  ← active (highlighted)
│    3 pins · Updated 2h  │
│ 📌 Financial Trail       │
│    12 pins · Updated 1d │
│ 📌 Untitled Board        │
│    0 pins · Just created │
│ ─────────────────────── │
│ Forked Boards            │
│ 📌 @researcher's Flight  │
│    Analysis (read-only)  │
└─────────────────────────┘
```

- Click to switch boards (loads board data)
- Right-click for rename/delete/duplicate/publish
- Drag to reorder (optional, P2)

### Checklist
- [ ] Board list component
- [ ] Create new board
- [ ] Switch between boards
- [ ] Rename board
- [ ] Delete board (with confirmation)
- [ ] Active board highlighting

---

## Verification

1. Create board → add pins from pinboard and from other pages → see them appear on canvas
2. Drag pins, draw connections, create sections → reload → everything persists
3. Pan/zoom feels smooth at 50+ pins
4. Pin from entity page → board picker appears → pin lands on board
5. Minimap reflects actual pin layout
6. `pnpm tsc --noEmit` passes

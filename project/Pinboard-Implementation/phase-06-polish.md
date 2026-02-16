# Phase 6: Polish, Performance, Mobile

## Goal

Harden the pinboard for real-world use: performance at scale, responsive design, keyboard
accessibility, undo/redo, and the small UX details that make it feel professional.

## Status: NOT STARTED

## Dependencies: Phases 1-3 complete, Phases 4-5 can be in progress

---

## Step 6.1: Performance Optimization

### Virtualized Pin Rendering

At 100+ pins, rendering all pin cards in the DOM gets slow. Implement viewport culling:
- Only render pins visible in the current viewport (+ margin)
- Track viewport bounds from pan/zoom state
- Use `useMemo` to filter visible pins each frame
- Connections: only render SVG lines where at least one endpoint is visible

**File:** `components/pinboard/PinboardCanvas.tsx`

```typescript
const visiblePins = useMemo(() => {
  const { x, y, zoom } = viewport
  const viewBounds = {
    left: -x / zoom - MARGIN,
    top: -y / zoom - MARGIN,
    right: (-x + windowWidth) / zoom + MARGIN,
    bottom: (-y + windowHeight) / zoom + MARGIN,
  }
  return pins.filter(p => isInBounds(p.position, viewBounds))
}, [pins, viewport, windowWidth, windowHeight])
```

### Debounced Persistence

- Pin position changes: debounce 500ms, then batch PATCH
- Board viewport (pan/zoom position): debounce 2000ms, save to `pin_boards.viewport`
- Connection changes: immediate (less frequent)

### Lazy Enrichment

Don't enrich all pins on load. Instead:
- Enrich visible pins first (based on viewport)
- Enrich remaining pins in background
- Cache enrichment data with 60s staleTime
- Skeleton shimmer while loading

### Checklist
- [ ] Viewport culling for pins and connections
- [ ] Debounced position persistence
- [ ] Viewport state saved/restored
- [ ] Lazy enrichment by viewport priority
- [ ] Performance test: 200 pins, smooth pan/zoom

---

## Step 6.2: Undo/Redo

**File:** `lib/pinboard/history.ts`

Maintain a command stack for reversible operations:

| Action | Undo |
|--------|------|
| Add pin | Remove pin |
| Remove pin | Re-add pin at same position |
| Move pin(s) | Move back to previous position |
| Add connection | Remove connection |
| Remove connection | Re-add connection |
| Add section | Remove section |
| Delete section | Re-add section with contents |

### Implementation

Use a simple command pattern:
```typescript
interface HistoryEntry {
  do: () => Promise<void>
  undo: () => Promise<void>
  description: string
}

const history: HistoryEntry[] = []
let cursor = -1
```

- Ctrl+Z / Cmd+Z: undo
- Ctrl+Shift+Z / Cmd+Shift+Z: redo
- Keep last 50 operations
- Clear forward history on new action (standard behavior)

Each command calls the API for both do and undo, so the DB stays in sync.

### Checklist
- [ ] History stack implementation
- [ ] Undo/redo keyboard shortcuts
- [ ] Undo/redo buttons in toolbar
- [ ] History entries for all reversible operations
- [ ] DB stays in sync on undo

---

## Step 6.3: Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Delete` / `Backspace` | Remove selected pin(s) |
| `Ctrl+A` | Select all pins |
| `Escape` | Deselect all / close sidebar |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `Ctrl+C` | Copy selected pin(s) to clipboard |
| `Ctrl+V` | Paste pin(s) (duplicate at cursor) |
| `Space` (hold) | Pan mode (cursor changes to grab) |
| `+` / `-` | Zoom in/out |
| `Ctrl+0` | Fit to content |
| `Ctrl+G` | Toggle grid snap |
| `N` | Add note pin at cursor position |
| `Tab` | Cycle through pins |

**File:** `components/pinboard/useCanvasShortcuts.ts`

Register shortcuts via `useEffect` with `keydown` listener. Only active when canvas is
focused (not when typing in sidebar/dialog inputs).

### Checklist
- [ ] All shortcuts implemented
- [ ] Shortcuts don't fire when typing in inputs
- [ ] Shortcut help overlay (? key)

---

## Step 6.4: Responsive / Mobile

The pinboard is primarily a desktop tool (spatial reasoning needs screen space), but it should
be usable on tablet and gracefully degrade on mobile.

### Tablet (768px-1024px)
- Sidebar collapses to overlay
- Toolbar wraps to two rows
- Touch drag for pins
- Two-finger pan/pinch zoom

### Mobile (<768px)
- Canvas is full-screen, toolbar is bottom sheet
- Pins show as a scrollable list instead of spatial canvas (fallback)
- "Pin to Board" from other pages still works
- Board management (create/delete) works
- Viewing others' published boards works in list mode
- Banner: "For the full spatial experience, use a desktop browser"

### Checklist
- [ ] Tablet layout with touch support
- [ ] Mobile list-view fallback
- [ ] Bottom sheet toolbar on mobile
- [ ] "Pin to Board" works on mobile
- [ ] Published boards viewable on mobile

---

## Step 6.5: Accessibility

| Requirement | Implementation |
|-------------|---------------|
| Screen reader | Pins have `aria-label` with type + title + stats |
| Focus management | Tab through pins, Enter to select, arrow keys to move |
| Color contrast | Pin type colors meet WCAG AA on dark background |
| Keyboard-only | All operations possible without mouse |
| Reduced motion | Respect `prefers-reduced-motion` for animations |
| High contrast | Pin borders thicken in high-contrast mode |

### Checklist
- [ ] All pins have descriptive aria-labels
- [ ] Tab navigation between pins
- [ ] Arrow key pin movement (with grid snap)
- [ ] Skip to main content link
- [ ] Reduced motion support
- [ ] Color contrast audit

---

## Step 6.6: Empty State & Onboarding

**File:** `components/pinboard/PinboardOnboarding.tsx`

First-time users see an interactive tutorial:

1. "Welcome to your Evidence Pinboard" — explains the concept
2. "Let's create your first board" — auto-creates "My First Board"
3. "Pin something" — highlights the Pin button on a sample entity
4. "Draw a connection" — shows how to connect two pins
5. "The AI will help" — points to the suggestions panel

After the tutorial, the user has a board with 2-3 pins and understands the core flow.

For returning users with no boards (all deleted), show a simple empty state with "Create
Board" CTA — no tutorial replay.

### Checklist
- [ ] Tutorial flow for first-time users
- [ ] Empty state for returning users
- [ ] Tutorial can be dismissed and not shown again
- [ ] Tutorial state persisted in `user_profiles` metadata or localStorage

---

## Step 6.7: Testing

### Unit Tests
- Layout algorithms (force-directed, timeline)
- History stack (undo/redo ordering)
- Viewport culling (correct pin filtering)

### Integration Tests
- Board CRUD API routes
- Pin CRUD API routes
- Fork flow
- Publish/unpublish flow
- RLS: private boards not visible to other users

### E2E Tests
**File:** `e2e/pages/pinboard.spec.ts` (update existing)

- Create board → add note pin → verify it appears
- Drag pin → reload → verify position persisted
- Draw connection → verify line renders
- Pin from entity page → verify pin appears on board
- Publish board → verify public URL works
- Fork board → verify independent copy

### Checklist
- [ ] Unit tests for layout algorithms
- [ ] Unit tests for history stack
- [ ] Integration tests for all API routes
- [ ] E2E tests for core flows
- [ ] All existing tests still pass

---

## Verification

1. 200 pins render smoothly with pan/zoom
2. Undo/redo works for all operations
3. Keyboard-only user can create board, add pins, draw connections
4. Tablet: touch drag and pinch zoom work
5. Mobile: list view shows all pins, "Pin to Board" works
6. First-time user completes tutorial and has working board
7. All tests pass including new pinboard tests

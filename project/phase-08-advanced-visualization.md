# Phase 8: Advanced Visualization

> **Sessions:** 2 | **Dependencies:** Phase 4 (API), Phase 5 (redaction/entity components) | **Parallel with:** Nothing specific

## Summary

Build the D3 force-directed entity relationship graph (with connection path finder, temporal animation, community detection), interactive timeline view, cascade replay animation, geographic map view, evidence pinboard, document comparison visualization, and researcher placeholder pages. These are the visually impressive features that demonstrate the platform's analytical capabilities and help researchers and prosecutors see the big picture.

## Checklist

### Entity Relationship Graph

- [ ] `app/(public)/graph/page.tsx` — Full-screen graph visualization page
  - Full viewport graph canvas
  - Controls overlay (top-right): zoom, reset, fullscreen
  - Filter overlay (left): entity type toggles, date range, search-to-highlight
  - Entity sidebar (right): appears on node click, shows entity details
  - Edge info panel: appears on edge click, shows evidence documents
  - Loading state with skeleton
  - Empty state: "Entity graph will populate as documents are processed"

### Graph Components

- [ ] `components/graph/RelationshipGraph.tsx` — D3 force-directed graph
  - D3.js force simulation (forceLink, forceCharge, forceCenter, forceCollide)
  - Nodes: entities, colored by type (person=blue, org=purple, location=green, etc.)
  - Node size: proportional to mention_count (log scale)
  - Node labels: entity name (truncated, full on hover)
  - Edges: relationships, colored by type
  - Edge thickness: proportional to relationship strength
  - Edge labels: relationship type (shown on hover)
  - Zoom and pan (D3 zoom behavior)
  - Drag nodes to rearrange
  - Click node: highlight connected edges, open entity sidebar
  - Click edge: show evidence documents
  - Double-click node: navigate to entity page
  - SVG-based rendering (or Canvas for large graphs)
  - Dynamic import (lazy load D3 bundle)

- [ ] `components/graph/GraphControls.tsx` — Control panel
  - Zoom in/out buttons
  - Reset view button
  - Fullscreen toggle
  - Entity type filter checkboxes (show/hide by type)
  - Minimum connection strength slider
  - Search box (highlights matching nodes)
  - Layout algorithm toggle (force-directed, radial, hierarchical)
  - **"Find Path" tool** — select two entities, show shortest connection path
  - **Time slider** — scrub through dates to show how network evolved
  - **Cluster detection** — highlight automatically detected communities/groups
  - **Criminal indicator overlay** — color nodes by criminal indicator score (green→yellow→red)

- [ ] `components/graph/GraphTooltip.tsx` — Hover card for nodes/edges
  - Node hover: entity name, type, mention count, top connections
  - Edge hover: relationship type, strength, description, evidence count
  - Positioned near cursor, doesn't overflow viewport

### Timeline View

- [ ] `app/(public)/timeline/page.tsx` — Interactive timeline page
  - Vertical scrolling timeline
  - Filter bar at top (entity, date range, event type)
  - Year markers as section dividers
  - Event cards alternating left/right
  - Scroll-to-year navigation
  - Empty state with explanation

### Timeline Components

- [ ] `components/timeline/TimelineView.tsx` — Vertical scrolling timeline
  - Vertical line down center
  - Event cards branching left and right alternately
  - Year/month markers
  - Smooth scrolling with IntersectionObserver for lazy loading
  - "Load more" at bottom (or infinite scroll)
  - Responsive: single column on mobile

- [ ] `components/timeline/TimelineEvent.tsx` — Individual event card
  - Date display (with precision indicator: exact, approximate, etc.)
  - Event type badge (travel, meeting, legal, financial, etc.)
  - Description text
  - Location (if available)
  - Entity badges (clickable, link to entity pages)
  - Source document links (citations)
  - Connection line to timeline spine

- [ ] `components/timeline/TimelineFilters.tsx` — Filter controls
  - Entity search/select (multi-select)
  - Date range picker (from/to)
  - Event type filter checkboxes
  - Clear all filters button
  - Active filter count badge

### Cascade Replay Animation

- [ ] `app/(public)/cascade/[id]/page.tsx` — Animated cascade replay
  - Full-screen cascade visualization
  - Animated tree growth (Framer Motion)
  - Share button with OG meta tags
  - Final tally: "This discovery unlocked X connections across Y documents"
  - Link back to source redaction
  - Empty state for invalid cascade IDs

- [ ] `components/gamification/CascadeReplay.tsx` — Animated replay component
  - Starting node: the original solved redaction (glowing)
  - Phase 1: Lines animate outward to direct cascade matches
  - Phase 2: Cascaded nodes expand to their cascades
  - Phase 3: Continue recursively with decreasing opacity/speed
  - Phase 4: Final tally fades in
  - Controls: play/pause, speed (1x, 2x, 5x), reset
  - Implementation: Framer Motion for animations, D3 for tree layout
  - Dynamic import for bundle size

### Cascade OG Meta Tags

- [ ] Generate OpenGraph metadata for cascade pages
  - Title: "Cascade Impact: X connections unlocked"
  - Description: "A single discovery in the Epstein files cascaded to X matches across Y documents"
  - Image: server-rendered preview (or placeholder)

### Update CascadeTree Component

- [ ] Update `components/redaction/CascadeTree.tsx` from Phase 5
  - Replace static placeholder with animated CascadeReplay component
  - Add "View full replay" link to `/cascade/[id]`

### Geographic Map View

- [ ] `app/(public)/map/page.tsx` — Geographic evidence map
  - World map with location pins for all mentioned locations
  - Pin size proportional to mention frequency
  - Pin color by entity type (properties, meeting locations, travel destinations)
  - Click pin → sidebar with all documents mentioning that location
  - Date range filter — scrub through time to see location activity
  - Known properties highlighted (NYC, Palm Beach, NM ranch, Little St. James, Paris)
  - Flight route overlay (connect origin/destination locations from flight logs)
  - Heat map mode (density of mentions)
  - Empty state with placeholder map

- [ ] `components/map/EvidenceMap.tsx` — Map component (Mapbox GL JS or Leaflet)
  - Interactive map with clustering for dense areas
  - Popup on pin hover with location name, mention count, top entities
  - Route lines for flight data
  - Dynamic import for bundle size

- [ ] `components/map/MapControls.tsx` — Map filter panel
  - Location type filter (property, city, country, venue)
  - Date range slider
  - Entity filter (show locations connected to specific people)
  - Toggle: flight routes, properties, all mentions

- [ ] `components/map/MapSidebar.tsx` — Location detail sidebar
  - Location name, coordinates
  - All documents mentioning this location
  - Entities associated with this location
  - Timeline of activity at this location

### Connection Path Finder

- [ ] `components/graph/PathFinder.tsx` — Find shortest path between two entities
  - Two entity search inputs
  - "Find Connection" button
  - Visual path display showing each intermediate entity and relationship
  - Evidence documents supporting each link in the chain
  - "X degrees of separation" summary
  - Exportable as evidence chain for prosecutors

### Temporal Network Animation

- [ ] `components/graph/TemporalGraph.tsx` — Time-evolving network
  - Timeline scrubber below graph canvas
  - Play/pause button to animate network evolution over time
  - Nodes appear when entity first mentioned, fade when last mentioned
  - Edges appear/disappear based on relationship date ranges
  - Speed control (1x, 2x, 5x)
  - Key event markers on timeline (arrests, raids, legal proceedings)

### Evidence Pinboard

- [ ] `app/(auth)/pinboard/page.tsx` — Drag-and-drop evidence board
  - Virtual corkboard canvas
  - Pin documents, images, entities, timeline events, text notes
  - Draw labeled connections between pins (arrows with relationship labels)
  - Red string visual metaphor (connecting pins with lines)
  - Zoom and pan on large boards
  - Share board via URL (public/private toggle)
  - Export as image or PDF
  - Multiple boards per user

- [ ] `components/pinboard/PinboardCanvas.tsx` — Main canvas component
  - Drag-and-drop pins
  - Connection drawing tool
  - Zoom/pan controls
  - Grid snap toggle

- [ ] `components/pinboard/PinItem.tsx` — Individual pin on the board
  - Compact card showing document/entity/image preview
  - Drag handle
  - Edit/remove buttons
  - Connection anchor points

- [ ] `components/pinboard/AddPinDialog.tsx` — Search and pin items
  - Search across documents, entities, images
  - Preview before pinning
  - Add text note pins

### Researcher Pages (Placeholders)

- [ ] `app/(researcher)/export/page.tsx` — Bulk data export
  - "Coming soon" state with description
  - What will be available: CSV export, JSON export, filtered exports
  - Tier requirement explanation (Researcher $9/mo)

- [ ] `app/(researcher)/api-docs/page.tsx` — API documentation
  - "Coming soon" state with description
  - Preview of available endpoints
  - Rate limiting and authentication info
  - Tier requirement explanation

### Gamification API Stubs

- [ ] `app/api/gamification/leaderboard/route.ts` — Leaderboard stub
  - GET: Returns empty leaderboard array with correct response shape
  - Ready for Phase 10 implementation

- [ ] `app/api/gamification/achievements/route.ts` — Achievements stub
  - GET: Returns empty achievements array
  - Ready for Phase 10 implementation

- [ ] `app/api/gamification/cascade-replay/[id]/route.ts` — Cascade replay data
  - GET: Return cascade tree data for animation
  - Recursive query following `cascade_source_id` chain
  - Return nodes and edges for tree visualization

### Entity Connections Update

- [ ] Update `components/entity/EntityConnections.tsx` from Phase 3
  - Replace placeholder with mini version of RelationshipGraph
  - Filtered to show only connections for this entity
  - Limited depth (2 hops from center entity)
  - Smaller canvas, simplified controls

## Files to Create

```
app/(public)/
├── graph/
│   └── page.tsx
├── timeline/
│   └── page.tsx
├── map/
│   └── page.tsx
├── cascade/[id]/
│   └── page.tsx
app/(auth)/
└── pinboard/
    └── page.tsx
app/(researcher)/
├── export/
│   └── page.tsx
└── api-docs/
    └── page.tsx
app/api/gamification/
├── leaderboard/
│   └── route.ts
├── achievements/
│   └── route.ts
└── cascade-replay/[id]/
    └── route.ts
components/graph/
├── RelationshipGraph.tsx
├── GraphControls.tsx
├── GraphTooltip.tsx
├── PathFinder.tsx
└── TemporalGraph.tsx
components/timeline/
├── TimelineView.tsx
├── TimelineEvent.tsx
└── TimelineFilters.tsx
components/map/
├── EvidenceMap.tsx
├── MapControls.tsx
└── MapSidebar.tsx
components/pinboard/
├── PinboardCanvas.tsx
├── PinItem.tsx
└── AddPinDialog.tsx
components/gamification/
└── CascadeReplay.tsx
```

## Updates to Existing Files

```
components/redaction/CascadeTree.tsx          — Integrate animated replay
components/entity/EntityConnections.tsx       — Use mini RelationshipGraph
```

## Acceptance Criteria

1. Graph page renders with D3 force simulation (even with empty data)
2. Graph nodes are colored by entity type and sized by mention count
3. Graph edges show relationship types with varying thickness
4. Graph zoom, pan, and node drag work smoothly
5. Graph controls: entity type filters toggle nodes, search highlights matching nodes
6. Click node opens entity sidebar, click edge shows evidence
7. **Path finder:** select two entities → shows shortest connection path with evidence
8. **Time slider:** scrubbing shows network evolution over date range
9. **Criminal indicator overlay:** nodes colored by risk level
10. Timeline renders vertical layout with alternating event cards
11. Timeline filters work: entity, date range, event type
12. Timeline is responsive (single column on mobile)
13. **Geographic map** renders with location pins, flight routes, and date filtering
14. **Map click** → sidebar with documents mentioning that location
15. Cascade replay animates tree growth with Framer Motion
16. Cascade page has correct OpenGraph meta tags for sharing
17. **Evidence pinboard** allows drag-and-drop pins with connection drawing
18. Pinboard can be shared via public URL
19. Researcher pages show "coming soon" placeholders
20. Gamification API stubs return correct empty response shapes
21. Entity connections component shows mini graph for an entity
22. D3, Mapbox/Leaflet, and Framer Motion are dynamically imported (not in main bundle)

## Performance Notes

- D3 bundle is large (~250KB) — must be dynamically imported with `React.lazy()`
- Mapbox GL JS or Leaflet: also dynamically imported (~200KB)
- Graph rendering: use Canvas for >500 nodes, SVG for <500
- Timeline: use virtualization or IntersectionObserver for 1000+ events
- Cascade animation: limit to 200 nodes for smooth animation, summarize deeper cascades
- Framer Motion: import only needed components (`motion`, `AnimatePresence`)
- Pinboard canvas: use HTML5 Canvas or an SVG-based library for performance
- Temporal graph animation: pre-compute snapshots, animate between them

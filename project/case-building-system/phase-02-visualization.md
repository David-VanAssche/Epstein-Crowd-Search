# Phase 2: Embedding Map Visualization

**Status:** Not started
**Prerequisites:** Phase 1 (topic clustering + 2D coordinates)
**Blocks:** None (parallel with Phase 3)

## Architecture Decision: Vector Tiles + Deck.gl MVT

The council review (Gemini 3 Pro) confirmed: raw 8M point scatter will crash browsers. The solution is treating this as a GIS problem — pre-process points into vector tiles, render only visible viewport.

```
Pre-compute (server):
  UMAP 2D coords + cluster IDs + metadata
    → Tippecanoe → .mbtiles / .pbf tiles

Runtime (browser):
  Deck.gl MVTLayer (loads tiles for current viewport)
    + H3HexagonLayer (aggregation at low zoom)
    + ScatterplotLayer (entity search overlay)
```

## Checklist

### 2.1 Tile Generation Pipeline
- [ ] Install Tippecanoe: `brew install tippecanoe` (macOS) or build from source
- [ ] Export tile input data as GeoJSON or CSV:
  ```
  chunk_id, x (UMAP), y (UMAP), topic_cluster_id, topic_label,
  document_id, document_title, criminal_score, entity_ids[]
  ```
- [ ] Run Tippecanoe:
  ```bash
  tippecanoe -o corpus-map.mbtiles \
    -zg \                           # auto zoom levels
    --drop-densest-as-needed \      # LOD: thin points at low zoom
    --extend-zooms-if-still-dropping \
    --cluster-distance=10 \         # aggregate nearby points
    input.csv
  ```
- [ ] Host tiles: either static `.pbf` files on Supabase Storage or dynamic via `pg_tileserv`
- [ ] Verify: tiles load at all zoom levels, no missing data

### 2.2 Deck.gl MVT Renderer
- [ ] Install: `pnpm add @deck.gl/core @deck.gl/layers @deck.gl/extensions @deck.gl/geo-layers`
- [ ] Create `components/embedding-map/EmbeddingMap.tsx`:
  - `MVTLayer` for point rendering from vector tiles
  - Color mapping: topic_cluster_id → color palette (use d3-scale-chromatic categorical)
  - Viewport state management via Zustand (sync with sidebar)
- [ ] Implement LOD switching:
  - Zoom levels 0-4: `H3HexagonLayer` or `HeatmapLayer` (aggregated density)
  - Zoom levels 5+: `MVTLayer` (individual points from tiles)
- [ ] Verify: smooth pan/zoom at 60fps on mid-range hardware

### 2.3 Interaction Design
- [ ] **Hover tooltip** (high zoom only):
  - Do NOT use React state for tooltip — too slow at this scale
  - Use Deck.gl `picking` engine → update a `ref`-based HTML overlay
  - Show: document title, topic label, 50-char snippet
- [ ] **Click → Context Drawer**:
  - Click point → open side sheet with document details
  - Link to full document viewer
  - Show entity list, criminal indicators for that document
- [ ] **Lasso/rectangle select** (optional):
  - Select a region → batch filter document browser
- [ ] Verify: tooltip appears within 50ms, no lag on interaction

### 2.4 Topic Sidebar (Hierarchical Filter)
- [ ] Create `components/embedding-map/TopicSidebar.tsx`:
  - Virtualized tree using `react-virtuoso` or `@tanstack/react-virtual`
  - ~200 meta-topics (collapsible) containing ~2000 sub-topics
  - Each row: topic label + chunk count badge
  - Search/filter input at top
- [ ] Topic selection behavior:
  - Click topic → highlight those points on map (via Deck.gl `DataFilterExtension`)
  - Multi-select → union filter
  - Clear all → show everything
- [ ] Integrate with document browser: selected topics filter the doc list
- [ ] Verify: sidebar renders instantly, search is responsive, filter updates map

### 2.5 Entity Search Overlay
- [ ] Search input: user types entity name
- [ ] API call: `GET /api/entity/search?q=...` → returns entity ID + chunk IDs + XY coordinates
- [ ] Render as **separate `ScatterplotLayer`** on top of base MVT layer:
  - Base layer: desaturate (reduce opacity to 0.2)
  - Entity points: large, high-contrast circles (neon green/pink)
  - Optional: pulse animation via custom shader
- [ ] Verify: searching for "Epstein" highlights thousands of points without lag

### 2.6 Criminal Indicator Overlay
- [ ] Mode toggle in toolbar: "Exploration" / "Risk Analysis" / "Contour"
  - **Exploration (default):** Color = topic cluster. Opacity = criminal risk (transparent = low, opaque = high)
  - **Risk Analysis:** Color = criminal score gradient (green → yellow → red). Topic ignored.
  - **Contour overlay:** Keep topic colors + add `ContourLayer` isolines showing criminal density
- [ ] Verify: modes switch smoothly, no visual overload

### 2.7 Responsive & Accessibility
- [ ] Mobile detection: serve static image or hexbin-only view on mobile
- [ ] "List View" toggle: swap map for virtualized document list (filtered by current viewport)
- [ ] Keyboard navigation: sidebar tree fully navigable via Tab/Arrow
- [ ] Screen reader: ARIA labels on mode toggles and search
- [ ] Verify: works on tablet, degrades gracefully on mobile

### 2.8 Page Route
- [ ] Create `app/(public)/embedding-map/page.tsx`
- [ ] Add to sidebar navigation
- [ ] Server-side: tile URL configuration, initial viewport
- [ ] Client-side: Deck.gl canvas + sidebar + toolbar

## Files to Create

| File | Purpose |
|------|---------|
| `scripts/clustering/generate-tiles.sh` | Tippecanoe tile generation |
| `components/embedding-map/EmbeddingMap.tsx` | Main map component |
| `components/embedding-map/TopicSidebar.tsx` | Hierarchical filter sidebar |
| `components/embedding-map/EntityOverlay.tsx` | Entity search highlight layer |
| `components/embedding-map/MapToolbar.tsx` | Mode toggles, search input |
| `components/embedding-map/MapTooltip.tsx` | Ref-based hover tooltip |
| `app/(public)/embedding-map/page.tsx` | Page route |
| `lib/hooks/useEmbeddingMap.ts` | Zustand store for viewport state |

## Dependencies to Add

```
@deck.gl/core @deck.gl/layers @deck.gl/extensions @deck.gl/geo-layers
@deck.gl/mesh-layers maplibre-gl react-map-gl
react-virtuoso zustand d3-scale-chromatic
```

## Agent Workflow

```
1. PLAN:    Launch FrontendExpert (Gemini) to finalize component architecture
2. BUILD:   Implement tile generation + Deck.gl components
3. REVIEW:  Launch FrontendExpert for UI/perf review
            Launch CodeReviewer for code quality
4. TEST:    Load tiles in browser, verify LOD transitions + interactions
5. VERIFY:  Test on multiple browsers + tablet
```

## Definition of Done

- [ ] Embedding map renders at 60fps with all 8M chunks (via tiling)
- [ ] LOD transitions smoothly between hexbin and point views
- [ ] Topic sidebar filters map in real-time
- [ ] Entity search highlights matching points
- [ ] Criminal indicator overlay modes work
- [ ] Mobile fallback renders
- [ ] Page accessible from sidebar navigation

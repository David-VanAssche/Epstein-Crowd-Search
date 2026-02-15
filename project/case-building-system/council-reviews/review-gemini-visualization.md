# Council Review: Visualization Architecture
**Reviewer:** Gemini 3 Pro (via Google AI)
**Focus:** WebGL rendering, interaction design, large-scale data viz

## Key Findings

### 1. Raw Deck.gl at 8M Points: WILL CRASH

"This is a GIS engineering task, not a charting task. If you load 8M JSON objects into React state or a standard ScatterplotLayer, the browser tab will crash (OOM) or run at 1 FPS."

**Solution: Vector Tiles (MVT)**
- Use **Tippecanoe** to pre-process 8M points into `.mbtiles` / `.pbf` tiles
- **Deck.gl MVTLayer** loads only visible viewport at current zoom level
- Handles quadtree logic, culling, and progressive loading automatically
- Alternative: **Deepscatter** (by Nomic AI) — specialized for zoomable embedding maps

### 2. LOD Strategy

| Zoom Level | Visual | Interaction |
|------------|--------|-------------|
| 0-4 (macro) | H3HexagonLayer or HeatmapLayer. No individual points. | Hover: cluster name + count. Click: zoom to region. |
| 5+ (micro) | MVTLayer (individual points from tiles) | Hover: document title + snippet. Click: context drawer. |

**Critical:** Do NOT render React tooltips on `onHover` — too slow. Use Deck.gl picking engine → update a `ref`-based HTML overlay (bypass React render cycle).

### 3. Topic Sidebar Architecture

- 500 checkboxes in DOM will lag → use **react-virtuoso** or **@tanstack/react-virtual**
- Only render ~20 visible rows
- Flatten hierarchy with `depth` and `parentId`
- Filtering options:
  - Pass `DataFilterExtension` to Deck.gl for client-side filtering on visible tiles
  - Or filter server-side (PostGIS) and reload tiles (slower but accurate)

### 4. Entity Search Overlay

Cannot rely on MVT tiles for entity search (entity might be in unloaded tile).

**Architecture:**
1. User types entity name in search
2. API returns XY coordinates of all matching chunks (~50-5000 points)
3. Render as **separate ScatterplotLayer** on top of base MVT layer
4. Base layer: desaturate (opacity 0.2)
5. Entity points: large, high-contrast circles (neon green/pink) with pulse animation

### 5. Criminal Indicator Encoding

Three competing signals: Topic (color), Criminality (?), Entity (highlight). Solution: **Mode switching:**

- **Mode 1 (Exploration):** Color = topic. Opacity = criminal risk (transparent = low, opaque = high).
- **Mode 2 (Risk Analysis):** Color = criminal score gradient (red). Topic ignored.
- **Mode 3 (Contour):** Topic colors + ContourLayer isolines showing criminal density.

### 6. Performance Architecture

**Server-side:**
- PostGIS + `ST_AsMVT` for dynamic tiles, OR
- Static `.pbf` files via Tippecanoe + Nginx/S3 (100x faster)
- Pre-compute all UMAP coordinates, never compute on-the-fly

**Client-side WebGL budget:**
- 8M vertices too high for mobile → detect and serve aggregated hexbin only
- Dispose WebGL contexts on page navigation
- Use SDF (Signed Distance Fields) for point rendering

### 7. Mobile & Accessibility

- **Mobile:** Serve static image or hexbin-only view. Disable individual points.
- **Accessibility:** Canvas invisible to screen readers. Provide "List View" toggle that swaps map for virtualized document list. Ensure sidebar fully keyboard navigable.

### Recommended Library Stack

| Library | Purpose |
|---------|---------|
| Deck.gl (MVTLayer, H3HexagonLayer) | Map rendering |
| MapLibre GL JS | Lightweight basemap under Deck.gl |
| Tippecanoe | Build-time tile generation |
| PostGIS `ST_AsMVT` | Runtime tile generation (if dynamic) |
| react-virtuoso | Virtualized topic sidebar |
| Zustand | Viewport state sync (map ↔ sidebar) |
| Apache Arrow | Raw data chunk fetching |

### Implementation Roadmap

1. Run UMAP → save CSV with x, y, topic_id, criminal_score
2. Run Tippecanoe → generate .mbtiles
3. Build Deck.gl viewer loading tiles
4. Implement LOD switching (hexbin ↔ MVT)
5. Build entity search spotlight layer
6. Build virtualized sidebar

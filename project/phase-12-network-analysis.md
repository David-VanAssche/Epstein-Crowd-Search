# Phase 12: Network Analysis & Intelligence

> **Sessions:** 3-4 | **Dependencies:** Phase 11, Phase 6, Phase 8 | **Parallel with:** Nothing

## Summary

Build the computational layer that turns raw entity relationships into actionable intelligence. Generates co-flight and co-communication links, computes PageRank/betweenness centrality/community detection, creates materialized views for flight stats and network metrics, implements BFS shortest path in plpgsql, and wires the graph page + entity connections to live API data. Adds temporal proximity detection (find co-occurring events within N-day windows), a path finder API, and 4 new chat tools for natural language queries against the network.

## IMPORTANT: Dependencies on Prior Phases

- Phase 11: All new tables (emails, financial_transactions, property_ownership) must exist
- Phase 6: Pipeline orchestrator for stage registration
- Phase 8: Graph visualization components exist but render empty arrays — this phase wires them

---

## Step-by-Step Execution

### Step 1: Add pipeline stages 15+16

File: `lib/pipeline/stages.ts` — MODIFY (already done in Phase 11 step)

Stages:
- `CO_FLIGHT_LINKS` (depends on ENTITY_EXTRACT)
- `NETWORK_METRICS` (depends on CO_FLIGHT_LINKS)

### Step 2: Build co-flight linker service

File: `lib/pipeline/services/co-flight-linker.ts` — NEW

- `CoFlightLinkerService.generateAllLinks()` method
- Finds flight co-occurrences (pairs of entities in same flight manifest docs)
- Finds email co-occurrences (from/to/cc entity pairs from emails table)
- Upserts `entity_relationships` with `traveled_with` and `communicated_with` types
- Log-normalized strength (log(count+1) / log(max+1))
- Idempotent: uses ON CONFLICT DO UPDATE

### Step 3: Create migration `00022_network_analysis.sql`

File: `supabase/migrations/00022_network_analysis.sql` — NEW

Contents:
1. `find_temporal_clusters(entity_uuid, window_days)` — returns flights, emails, timeline events, financial transactions within N-day windows for an entity
2. `find_co_temporal_entities(target_date, window_days, min_activity)` — entities active near a given date
3. `find_shortest_path(source_entity_id, target_entity_id, max_depth)` — BFS with temp table (ON COMMIT DROP for PgBouncer compatibility), path reconstruction via recursive CTE
4. Materialized view `flight_passenger_stats` — flight count, %, date range, top route, top 10 co-passengers per entity
5. Materialized view `email_communication_stats` — emails sent, threads, frequent contacts
6. Materialized view `entity_network_metrics` — degree, betweenness, PageRank, cluster_id
7. `refresh_network_views()` function — refreshes all 3 views CONCURRENTLY
8. UNIQUE INDEXes on each materialized view (required for CONCURRENTLY refresh)
9. Performance indexes for temporal queries

### Step 4: Build network metrics service

File: `lib/pipeline/services/network-metrics.ts` — NEW

- `NetworkMetricsService.computeAll()` method
- In-memory PageRank (power iteration, configurable rounds, damping=0.85)
- Betweenness centrality (random BFS sampling, 200 samples)
- Community detection (connected components + label propagation)
- Writes metrics to entity.metadata via `jsonb_merge_metadata` RPC with fallback
- Refreshes materialized views after computation

### Step 5: Create batch scripts

Files:
- `scripts/batch/generate-co-flight-links.ts` — NEW
- `scripts/batch/compute-network-metrics.ts` — NEW

### Step 6: Add Zod schemas

File: `lib/api/schemas.ts` — MODIFY

New schemas: `temporalProximitySchema`, `pathFinderSchema`, `flightStatsSchema`, `networkMetricsSchema`, `networkAnalysisSchema`

Critical: extend `NUMERIC_PARAMS` set with `window_days`, `max_depth`, `max_results`, `min_amount`, `max_amount`, `min_flights`, `min_degree`, `cluster_id`, `claim_a_page_number`, `claim_b_page_number`

### Step 7: Create API routes (6 routes)

Files:
- `app/api/analysis/temporal-proximity/route.ts` — calls `find_temporal_clusters` RPC
- `app/api/analysis/flight-stats/route.ts` — queries `flight_passenger_stats` materialized view
- `app/api/analysis/network-metrics/route.ts` — queries `entity_network_metrics` materialized view
- `app/api/graph/path/route.ts` — resolves entity names/UUIDs, calls `find_shortest_path`, enriches with document info
- `app/api/graph/entities/route.ts` — top N entities + inter-relationships as `{ nodes, edges }`, BFS from specific entity

### Step 8: Wire graph page to live data

File: `app/(public)/graph/page.tsx` — MODIFY

- Replace empty useState with useEffect fetch from `/api/graph/entities`
- Accept `?entity=UUID` query param for entity-centric view
- Add loading state
- Pass fetched nodes/edges to existing D3 visualization

### Step 9: Wire EntityConnections to live data

File: `components/entity/EntityConnections.tsx` — MODIFY

- Fetch from `/api/entity/${entityId}/connections?depth=2&limit=50` on mount
- Map API response to GraphNode/GraphEdge format for existing RelationshipGraph

### Step 10: Create 4 chat tools

Files:
- `lib/chat/tools/find-path.ts` — `findPathTool` using `find_shortest_path`
- `lib/chat/tools/temporal-analysis.ts` — `temporalAnalysisTool` using `find_temporal_clusters`
- `lib/chat/tools/flight-analysis.ts` — `flightAnalysisTool` querying `flight_passenger_stats`
- `lib/chat/tools/financial-analysis.ts` — `financialAnalysisTool` querying financial_transactions

### Step 11: Register chat tools

File: `lib/chat/chat-orchestrator.ts` — MODIFY: import and register 4 new tools

### Step 12: Create type definitions

File: `types/analysis.ts` — NEW: TemporalActivity, FlightPassengerStat, EmailCommunicationStat, EntityNetworkMetric, PathStep, PathFinderResponse, CentralityEntry, NetworkCluster, DOJRelease, CoTemporalEntity

---

## Gotchas

1. NUMERIC_PARAMS must include all new numeric query params or Zod receives strings and silently coerces
2. Supabase FK join syntax `entities!from_entity_id(name)` requires explicit REFERENCES in migration
3. BFS `find_shortest_path` uses temp tables with ON COMMIT DROP for PgBouncer compatibility
4. Materialized views need UNIQUE INDEX before CONCURRENTLY refresh works
5. PageRank computed in Node.js (not SQL) — iterative power method doesn't map to recursive CTEs
6. `supabase.rpc()` returns a builder, not a Promise — use `{ error }` destructuring, not `.catch()`
7. Graph page entity param must handle both UUID and missing param gracefully
8. Co-flight linker strength normalization uses log scale to prevent Epstein (most flights) from dominating all edges
9. Path enrichment fetches evidence documents in a loop — batch into single `IN()` query per step
10. Network metrics fallback does read-then-write on entity metadata if RPC function doesn't exist yet

## Files Created/Modified

```
supabase/migrations/00022_network_analysis.sql                NEW
lib/pipeline/services/co-flight-linker.ts                     NEW
lib/pipeline/services/network-metrics.ts                      NEW
scripts/batch/generate-co-flight-links.ts                     NEW
scripts/batch/compute-network-metrics.ts                      NEW
app/api/analysis/temporal-proximity/route.ts                  NEW
app/api/analysis/flight-stats/route.ts                        NEW
app/api/analysis/network-metrics/route.ts                     NEW
app/api/graph/path/route.ts                                   NEW
app/api/graph/entities/route.ts                               NEW
lib/chat/tools/find-path.ts                                   NEW
lib/chat/tools/temporal-analysis.ts                           NEW
lib/chat/tools/flight-analysis.ts                             NEW
lib/chat/tools/financial-analysis.ts                          NEW
types/analysis.ts                                             NEW
lib/pipeline/stages.ts                                        MODIFY
lib/api/schemas.ts                                            MODIFY
lib/chat/chat-orchestrator.ts                                 MODIFY
app/(public)/graph/page.tsx                                   MODIFY
components/entity/EntityConnections.tsx                        MODIFY
package.json                                                  MODIFY
```

## Acceptance Criteria

- [x] Co-flight linker generates `traveled_with` edges with normalized strength; idempotent
- [x] Network metrics computes PageRank, betweenness, cluster_id for connected entities
- [x] All 3 materialized views are populated and queryable after batch runs
- [x] `/api/graph/path?source=X&target=Y` returns shortest path with evidence
- [x] Graph page loads live data on mount (no more empty arrays)
- [x] All 4 chat tools registered and working
- [x] `pnpm tsc --noEmit` passes (non-test files)
- [x] `pnpm build` passes

# Phase 0: Prerequisites

One-time setup steps. Must complete before any import scripts run.

## 0A. Link Supabase CLI

The Supabase CLI needs to know which remote project to target.

```bash
npx supabase link --project-ref evcxibwuuhvvkrplazyk
```

**Verify**: `npx supabase projects list` should show LINKED column populated.

## 0B. Apply Pending Migrations

Migrations 00021-00024 are written but not applied to the remote database.

```bash
npx supabase db push
```

**What gets created**:
- `00021_structured_data_enrichment.sql`: `emails`, `financial_transactions`, `property_ownership`, `contradictions`, `thread_convergences` tables. Entity enrichment columns (`category`, `wikidata_id`, `photo_url`, `birth_date`, `death_date`).
- `00022_network_analysis.sql`: `find_temporal_clusters()`, `find_co_temporal_entities()`, `find_shortest_path()` functions. Materialized views: `flight_passenger_stats`, `email_communication_stats`, `entity_network_metrics`.
- `00023_research_tools.sql`: `doj_releases` table, `contradiction_votes` table with auto-update trigger.
- `00024_tighten_rls.sql`: Tightens contradictions INSERT RLS policy.

**Verify**:
```bash
# These should all return 200 (table exists):
curl -s -o /dev/null -w "%{http_code}" "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/emails?limit=0" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY"

curl -s -o /dev/null -w "%{http_code}" "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/doj_releases?limit=0" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY"
```

## 0C. Seed Reference Data

Create `scripts/import/seed-sources.ts` to populate the `data_sources` and `datasets` tables.

### data_sources table (24 rows)

Each row represents one community/official data source. Fields:
- `name`: Human-readable name (e.g., "s0fskr1p OCR Text")
- `source_type`: 'github' | 'huggingface' | 'kaggle' | 'web' | 'archive' | 'zenodo'
- `url`: Original source URL
- `data_type`: 'ocr' | 'embeddings' | 'entities' | 'chunks' | 'structured' | 'raw'
- `status`: Start as 'pending'
- `expected_count`: File count from manifest
- `priority`: Higher = import first

Source data comes from `scripts/hoarder/sources.py` and Storage manifests at `raw-archive/_manifests/`.

### datasets table (12+ rows)

One row per DOJ dataset grouping:
```
Dataset 1:  General documents
Dataset 2:  Court filings
...
Dataset 12: Supplemental release
```

Plus additional rows for community dataset groupings (e.g., "Community OCR", "Community Entities").

### Run

```bash
npx tsx scripts/import/seed-sources.ts
```

**Verify**:
```sql
SELECT COUNT(*) FROM data_sources;  -- should be 24
SELECT COUNT(*) FROM datasets;       -- should be 12+
```

## 0D. Install Required Dependencies

```bash
# AWS SDK for Bedrock embedding (Phase 3) — CRITICAL: embedding-service.ts
# currently uses raw fetch() without SigV4 signing, which will 403.
# This SDK is required to fix it.
pnpm add @aws-sdk/client-bedrock-runtime

# SQLite reader for Phase 2 Priority 5 (maxandrews/lmsband entity databases)
pnpm add -D better-sqlite3 @types/better-sqlite3
```

**Why these are critical**: See [AUDIT-FINDINGS.md](./AUDIT-FINDINGS.md) items C1 and H1.

## Environment Variables Required

All import scripts need these in `.env`:
```
NEXT_PUBLIC_SUPABASE_URL=https://evcxibwuuhvvkrplazyk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
AWS_ACCESS_KEY_ID=...        # For Phase 3 embedding
AWS_SECRET_ACCESS_KEY=...    # For Phase 3 embedding
AWS_REGION=us-east-1
GOOGLE_AI_API_KEY=...        # For Phase 4 entity extraction (Gemini Flash)
```

## Checklist

- [ ] Supabase CLI linked to project `evcxibwuuhvvkrplazyk`
- [ ] Migrations 00021-00024 applied
- [ ] `@aws-sdk/client-bedrock-runtime` installed
- [ ] `better-sqlite3` + types installed as devDependencies
- [ ] `data_sources` table seeded (24 rows)
- [ ] `datasets` table seeded (12+ rows)
- [ ] `.env` has all required variables
- [ ] VM upload to Storage still running / completed

# Phase F: Redacted Entity Inference

## Status: NOT STARTED

## Problem

When documents contain `[REDACTED]` sections, the redaction detector catalogs them with surrounding context, type estimates, and embeddings. But there is no system to:

1. **Cluster redactions** that likely refer to the same unknown person/entity across documents
2. **Create placeholder entities** like `[Redacted Person 003]` or `[Redacted Account 005]`
3. **Link these placeholders** into the entity graph so they appear in connections and dossiers
4. **Track resolution** — when the community (or evidence) reveals who `[Redacted Person 003]` actually is, merge them into the real entity

This is one of the most powerful features for investigative research — it lets researchers track unknown actors across the document corpus.

---

## Design Overview

The system works in three layers:

**Layer 1: Clustering** — Group redactions by similarity (embedding cosine + metadata matching)
**Layer 2: Entity Creation** — Create placeholder entities for each cluster
**Layer 3: Resolution** — When community votes confirm a redaction, merge placeholder into real entity

---

## Changes

### 1. Migration: Redacted Entity Clusters

**New file: `supabase/migrations/00030_redacted_entity_inference.sql`**

```sql
-- Cluster table: groups of redactions believed to be the same entity
CREATE TABLE redaction_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_label TEXT NOT NULL,         -- e.g. "Redacted Person 003"
  entity_type TEXT NOT NULL,           -- inferred from redaction_type
  placeholder_entity_id UUID REFERENCES entities(id) ON DELETE SET NULL,
  redaction_count INTEGER DEFAULT 0,
  document_count INTEGER DEFAULT 0,
  avg_confidence REAL DEFAULT 0,
  -- Cluster metadata
  common_co_entities UUID[],           -- entities frequently near these redactions
  common_document_types TEXT[],        -- doc classifications where cluster appears
  date_range TSTZRANGE,               -- earliest to latest document dates
  -- Resolution
  resolved_entity_id UUID REFERENCES entities(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  resolved_method TEXT,                -- 'community', 'ai_inference', 'admin'
  -- Tracking
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Link table: which redactions belong to which cluster
CREATE TABLE redaction_cluster_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id UUID NOT NULL REFERENCES redaction_clusters(id) ON DELETE CASCADE,
  redaction_id UUID NOT NULL REFERENCES redactions(id) ON DELETE CASCADE,
  similarity_to_centroid REAL,         -- how similar this redaction is to the cluster center
  added_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(cluster_id, redaction_id)
);

-- Indexes
CREATE INDEX idx_rcm_cluster ON redaction_cluster_members(cluster_id);
CREATE INDEX idx_rcm_redaction ON redaction_cluster_members(redaction_id);
CREATE INDEX idx_rc_placeholder ON redaction_clusters(placeholder_entity_id)
  WHERE placeholder_entity_id IS NOT NULL;
CREATE INDEX idx_rc_resolved ON redaction_clusters(resolved_entity_id)
  WHERE resolved_entity_id IS NOT NULL;

-- Auto-assign label sequence per type
CREATE SEQUENCE redacted_person_seq START 1;
CREATE SEQUENCE redacted_org_seq START 1;
CREATE SEQUENCE redacted_location_seq START 1;
CREATE SEQUENCE redacted_account_seq START 1;
CREATE SEQUENCE redacted_other_seq START 1;

-- Function to get next label for a type
CREATE OR REPLACE FUNCTION next_redacted_label(p_type TEXT)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_num INTEGER;
BEGIN
  CASE p_type
    WHEN 'person_name' THEN
      v_num := nextval('redacted_person_seq');
      RETURN 'Redacted Person ' || LPAD(v_num::TEXT, 3, '0');
    WHEN 'organization' THEN
      v_num := nextval('redacted_org_seq');
      RETURN 'Redacted Organization ' || LPAD(v_num::TEXT, 3, '0');
    WHEN 'location' THEN
      v_num := nextval('redacted_location_seq');
      RETURN 'Redacted Location ' || LPAD(v_num::TEXT, 3, '0');
    WHEN 'account_number' THEN
      v_num := nextval('redacted_account_seq');
      RETURN 'Redacted Account ' || LPAD(v_num::TEXT, 3, '0');
    ELSE
      v_num := nextval('redacted_other_seq');
      RETURN 'Redacted Entity ' || LPAD(v_num::TEXT, 3, '0');
  END CASE;
END;
$$;

-- Function to cluster redactions by embedding similarity
CREATE OR REPLACE FUNCTION find_similar_redactions(
  p_redaction_id UUID,
  p_threshold REAL DEFAULT 0.82,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE(
  redaction_id UUID,
  similarity REAL,
  redaction_type TEXT,
  document_id UUID,
  surrounding_text TEXT
) LANGUAGE sql STABLE AS $$
  SELECT
    r2.id AS redaction_id,
    1 - (r1.context_embedding <=> r2.context_embedding) AS similarity,
    r2.redaction_type,
    r2.document_id,
    r2.surrounding_text
  FROM redactions r1
  CROSS JOIN LATERAL (
    SELECT r2.*
    FROM redactions r2
    WHERE r2.id != r1.id
      AND r2.redaction_type = r1.redaction_type
      AND r2.context_embedding IS NOT NULL
      AND 1 - (r1.context_embedding <=> r2.context_embedding) > p_threshold
    ORDER BY r1.context_embedding <=> r2.context_embedding
    LIMIT p_limit
  ) r2
  WHERE r1.id = p_redaction_id
    AND r1.context_embedding IS NOT NULL;
$$;

-- Function to create a cluster from a set of redaction IDs
CREATE OR REPLACE FUNCTION create_redaction_cluster(
  p_redaction_ids UUID[],
  p_redaction_type TEXT
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_cluster_id UUID;
  v_label TEXT;
  v_entity_id UUID;
  v_doc_count INTEGER;
  v_entity_type TEXT;
BEGIN
  -- Generate label
  v_label := next_redacted_label(p_redaction_type);

  -- Map redaction type to entity type
  v_entity_type := CASE p_redaction_type
    WHEN 'person_name' THEN 'person'
    WHEN 'organization' THEN 'organization'
    WHEN 'location' THEN 'location'
    WHEN 'account_number' THEN 'account'
    ELSE 'person'  -- default
  END;

  -- Create placeholder entity
  INSERT INTO entities (name, entity_type, description, source, is_verified, metadata)
  VALUES (
    '[' || v_label || ']',
    v_entity_type,
    'Inferred placeholder entity from ' || array_length(p_redaction_ids, 1) ||
      ' redactions across multiple documents. The actual identity is unknown.',
    'redaction_inference',
    false,
    jsonb_build_object(
      'is_placeholder', true,
      'redaction_type', p_redaction_type,
      'cluster_label', v_label
    )
  )
  RETURNING id INTO v_entity_id;

  -- Count distinct documents
  SELECT COUNT(DISTINCT document_id) INTO v_doc_count
  FROM redactions WHERE id = ANY(p_redaction_ids);

  -- Create cluster
  INSERT INTO redaction_clusters (
    cluster_label, entity_type, placeholder_entity_id,
    redaction_count, document_count
  ) VALUES (
    v_label, v_entity_type, v_entity_id,
    array_length(p_redaction_ids, 1), v_doc_count
  )
  RETURNING id INTO v_cluster_id;

  -- Add members
  INSERT INTO redaction_cluster_members (cluster_id, redaction_id)
  SELECT v_cluster_id, unnest(p_redaction_ids);

  -- Create entity_mentions for the placeholder entity
  INSERT INTO entity_mentions (entity_id, document_id, chunk_id, mention_text, context_snippet, mention_type, confidence, page_number)
  SELECT v_entity_id, r.document_id, r.chunk_id, '[REDACTED]', r.surrounding_text, 'implied', 0.5, r.page_number
  FROM redactions r
  WHERE r.id = ANY(p_redaction_ids);

  -- Update mention/document counts on the placeholder entity
  UPDATE entities SET
    mention_count = array_length(p_redaction_ids, 1),
    document_count = v_doc_count
  WHERE id = v_entity_id;

  RETURN v_cluster_id;
END;
$$;

-- Function to resolve a cluster (merge placeholder into real entity)
CREATE OR REPLACE FUNCTION resolve_redaction_cluster(
  p_cluster_id UUID,
  p_real_entity_id UUID,
  p_method TEXT DEFAULT 'community'
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_placeholder_id UUID;
BEGIN
  -- Get placeholder entity ID
  SELECT placeholder_entity_id INTO v_placeholder_id
  FROM redaction_clusters
  WHERE id = p_cluster_id;

  IF v_placeholder_id IS NULL THEN
    RAISE EXCEPTION 'Cluster has no placeholder entity';
  END IF;

  -- Merge placeholder into real entity using existing merge function
  PERFORM merge_entities(p_real_entity_id, v_placeholder_id);

  -- Update cluster
  UPDATE redaction_clusters SET
    resolved_entity_id = p_real_entity_id,
    resolved_at = now(),
    resolved_method = p_method,
    updated_at = now()
  WHERE id = p_cluster_id;

  -- Update individual redactions
  UPDATE redactions SET
    resolved_entity_id = p_real_entity_id,
    status = 'confirmed',
    resolved_at = now(),
    resolved_method = 'cluster_resolution'
  WHERE id IN (
    SELECT redaction_id FROM redaction_cluster_members
    WHERE cluster_id = p_cluster_id
  );
END;
$$;
```

### 2. Clustering Service

**New file: `lib/pipeline/services/redaction-clusterer.ts`**

Two-phase algorithm:

**Phase 1: Pairwise Similarity**
For each unclustered redaction with an embedding:
- Find similar redactions via `find_similar_redactions()` RPC
- Build a similarity graph (adjacency list)

**Phase 2: Connected Components**
- Run union-find on the similarity graph
- Each connected component with >=2 members becomes a cluster candidate
- Filter: require same `redaction_type` within a cluster
- Boost confidence if `co_occurring_entity_ids` overlap between members
- Additional heuristics:
  - Same `char_length_estimate` (±3 chars) boosts similarity
  - Same `document_type` boosts similarity
  - Temporal proximity (documents from similar dates) boosts similarity

**Phase 3: Cluster Creation**
- For each cluster with >=2 members and avg similarity > 0.85:
  - Call `create_redaction_cluster()` RPC
  - This creates the placeholder entity, entity_mentions, and cluster records

```typescript
export async function runRedactionClustering(
  supabase: SupabaseClient,
  options?: {
    minClusterSize?: number    // default 2
    similarityThreshold?: number  // default 0.82
    maxClusters?: number       // default 500
    dryRun?: boolean
  }
): Promise<ClusteringResult>
```

### 3. Batch Clustering Script

**New file: `scripts/cluster-redactions.ts`**

```
npx tsx scripts/cluster-redactions.ts [options]

Options:
  --threshold 0.85    Similarity threshold (default: 0.82)
  --min-size 2        Minimum cluster size (default: 2)
  --max-clusters 500  Maximum clusters to create
  --dry-run           Show candidates without creating
  --type person_name  Only cluster redactions of this type
```

### 4. API Routes

**New file: `app/api/redaction-clusters/route.ts`**

```
GET /api/redaction-clusters?page=1&per_page=20&type=person&resolved=false
```

Returns paginated list of clusters with member count, document count, placeholder entity link.

**New file: `app/api/redaction-clusters/[id]/route.ts`**

```
GET /api/redaction-clusters/{id}
```

Returns full cluster detail: all member redactions with surrounding text, co-occurring entities, suggested matches.

**New file: `app/api/redaction-clusters/[id]/resolve/route.ts`**

```
POST /api/redaction-clusters/{id}/resolve
Body: { entity_id: "uuid" }
```

Requires auth. Calls `resolve_redaction_cluster()`. Merges placeholder into target entity.

### 5. UI: Redacted Entities Page

**New file: `app/(public)/redacted-entities/page.tsx`**

A dedicated page for browsing inferred redacted entities:

```
┌─ Redacted Entities ─────────────────────────────────────┐
│                                                          │
│  Inferred Unknown Actors                                 │
│  These are placeholder identities created by clustering  │
│  similar redactions across multiple documents.           │
│                                                          │
│  [Filter: All Types ▼]  [Show: Unresolved ▼]  42 total  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  [Redacted Person 003]           person  Unresolved│  │
│  │  Appears in 7 documents, 12 redactions             │  │
│  │  Common co-entities: Jeffrey Epstein, Sarah Kellen │  │
│  │  Avg confidence: 87%                               │  │
│  │  "...testified that [REDACTED] was present..."     │  │
│  │  "...contacted by [REDACTED] regarding..."         │  │
│  │  [View Cluster]  [Propose Identity]                │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  [Redacted Account 001]       account   ✅ Resolved│  │
│  │  → Merged into: Bear Stearns Account #4421        │  │
│  │  Was in 3 documents, 5 redactions                  │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 6. UI: Cluster Detail Page

**New file: `app/(public)/redacted-entities/[id]/page.tsx`**

Shows all redactions in a cluster, their documents, surrounding context, and allows proposing an identity:

```
┌─ [Redacted Person 003] ─────────────────────────────────┐
│                                                          │
│  12 redactions across 7 documents                        │
│  Avg similarity: 0.89  |  Type: person_name              │
│                                                          │
│  Frequently co-occurring with:                           │
│  [Jeffrey Epstein]  [Sarah Kellen]  [Ghislaine Maxwell]  │
│                                                          │
│  ── Evidence ──────────────────────────────────────────   │
│                                                          │
│  deposition-2005-03.pdf  (page 14)  sim: 0.93            │
│  "The witness testified that [REDACTED] was present      │
│   at the meeting on March 3rd, along with Epstein."      │
│                                                          │
│  police-report-2006.pdf  (page 7)  sim: 0.91             │
│  "...contacted by [REDACTED] regarding payment of..."    │
│                                                          │
│  ...                                                     │
│                                                          │
│  ── Community Proposals ──────────────────────────────   │
│  [Propose Identity: ____________________] [Submit]       │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 7. Sidebar Link

**Modified: `components/layout/AppSidebar.tsx`**

Add to the Investigate group:
```typescript
import { UserX } from 'lucide-react'
{ href: '/redacted-entities', label: 'Redacted Entities', icon: UserX },
```

### 8. Placeholder Entity Styling

When rendering placeholder entities in EntityCard, EntityProfile, and graph:
- Name always wrapped in brackets: `[Redacted Person 003]`
- Special dashed border style: `border-dashed border-amber-500/30`
- Amber question mark icon instead of type icon in avatar
- "Placeholder" badge in amber

Detection: check `entity.metadata?.is_placeholder === true` or `entity.source === 'redaction_inference'`

---

## Files Summary

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/00030_redacted_entity_inference.sql` | NEW | Cluster tables, sequences, functions |
| `lib/pipeline/services/redaction-clusterer.ts` | NEW | Clustering algorithm |
| `scripts/cluster-redactions.ts` | NEW | Batch CLI |
| `app/api/redaction-clusters/route.ts` | NEW | List clusters API |
| `app/api/redaction-clusters/[id]/route.ts` | NEW | Cluster detail API |
| `app/api/redaction-clusters/[id]/resolve/route.ts` | NEW | Resolution API |
| `app/(public)/redacted-entities/page.tsx` | NEW | Cluster browser page |
| `app/(public)/redacted-entities/[id]/page.tsx` | NEW | Cluster detail page |
| `components/layout/AppSidebar.tsx` | MODIFY | Add sidebar link |
| `components/entity/EntityCard.tsx` | MODIFY | Placeholder styling |
| `components/entity/EntityProfile.tsx` | MODIFY | Placeholder badge/styling |
| `components/entity/EntityAvatar.tsx` | MODIFY | Placeholder icon variant (if Phase A done) |

## Dependencies

- **Requires Phase D** (Redactions Tab) to be complete so users can see redactions in context
- Requires redactions to have `context_embedding` populated (pipeline `REDACTION_DETECT` + `EMBED` stages)
- Requires `merge_entities()` function (from migration 00027, already applied)

## Estimated Effort

Large. This is the most complex feature — new migration with 3 tables + 4 functions, a clustering algorithm, 3 API routes, 2 new pages, and integration points across entity components.

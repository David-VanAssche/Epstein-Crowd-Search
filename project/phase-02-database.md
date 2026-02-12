# Phase 2: Database

> **Sessions:** 1-2 | **Dependencies:** Phase 1 | **Parallel with:** Nothing (Phase 3+4 depend on this)

## Summary

Create all 18 Supabase migrations with exact SQL, set up Supabase client libraries for browser/server/admin use, create middleware for auth session refresh, and define TypeScript types for all database entities. This phase creates the complete data layer that all subsequent phases build on.

## IMPORTANT: Pre-requisites

Before starting Phase 2, verify:
1. Phase 1 is complete (`pnpm dev` runs, `pnpm build` succeeds)
2. You have a Supabase project created (org: "Epstein-Crowd-Research", free tier, East US)
3. You have the Supabase project URL and anon key in `.env.local`

---

## Step-by-Step Execution

### Step 1: Install Supabase dependencies

```bash
pnpm add @supabase/supabase-js @supabase/ssr
pnpm add -D supabase
```

### Step 2: Create directory structure

```bash
mkdir -p supabase/migrations
mkdir -p lib/supabase
mkdir -p types
mkdir -p scripts
```

### Step 3: Create `supabase/config.toml`

```toml
# supabase/config.toml
[project]
id = "" # Fill with your Supabase project ref after running `npx supabase link`

[api]
enabled = true
port = 54321
schemas = ["public", "graphql_public"]

[db]
port = 54322
major_version = 15

[studio]
enabled = true
port = 54323
```

### Step 4: Create Migration 00001 — Extensions

File: `supabase/migrations/00001_extensions.sql`

```sql
-- 00001_extensions.sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
```

### Step 5: Create Migration 00002 — Core Tables

File: `supabase/migrations/00002_core_tables.sql`

```sql
-- 00002_core_tables.sql

-- DOJ dataset groupings (1-12)
CREATE TABLE datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_number INTEGER UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  source_url TEXT,
  zip_size_gb NUMERIC,
  document_count INTEGER DEFAULT 0,
  page_count INTEGER DEFAULT 0,
  image_count INTEGER DEFAULT 0,
  video_count INTEGER DEFAULT 0,
  processing_status TEXT DEFAULT 'pending',
  date_range TSTZRANGE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Individual documents (PDFs, standalone files)
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID REFERENCES datasets(id),
  filename TEXT NOT NULL,
  original_path TEXT,
  storage_path TEXT,
  file_type TEXT NOT NULL,
  mime_type TEXT,
  file_size_bytes BIGINT,
  page_count INTEGER,
  ocr_text TEXT,
  classification TEXT,
  classification_confidence FLOAT,
  date_extracted TIMESTAMPTZ,
  date_range TSTZRANGE,
  is_redacted BOOLEAN DEFAULT false,
  redaction_count INTEGER DEFAULT 0,
  processing_status TEXT DEFAULT 'pending',
  processing_error TEXT,
  metadata JSONB DEFAULT '{}',
  ocr_source TEXT,           -- NULL | 's0fskr1p' | 'tensonaut' | 'pipeline' | etc.
  ocr_text_path TEXT,        -- storage path in ocr-text/ bucket
  embedding_source TEXT,     -- NULL | 'svetfm' | 'pipeline'
  chunk_count INT DEFAULT 0, -- denormalized for stats
  entity_count INT DEFAULT 0,
  ai_summary TEXT,           -- community or pipeline-generated
  hierarchy_json JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Text chunks with embeddings
CREATE TABLE chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  contextual_header TEXT,
  page_number INTEGER,
  page_range INT4RANGE,
  section_title TEXT,
  hierarchy_path TEXT[],
  content_embedding VECTOR(1024),
  content_tsv TSVECTOR,
  char_count INTEGER,
  token_count_estimate INTEGER,
  metadata JSONB DEFAULT '{}',
  embedding_model TEXT,      -- 'nomic-embed-text' | 'amazon.nova-multimodal-embeddings-v1:0' | NULL
  source TEXT,               -- 'svetfm' | 'benbaessler' | 'pipeline' | NULL
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(document_id, chunk_index)
);

-- Auto-generate tsvector on insert/update (for chunks — includes contextual_header)
CREATE OR REPLACE FUNCTION chunks_tsv_trigger() RETURNS TRIGGER AS $$
BEGIN
  NEW.content_tsv := to_tsvector('english', COALESCE(NEW.contextual_header, '') || ' ' || NEW.content);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER chunks_tsv_update
  BEFORE INSERT OR UPDATE OF content, contextual_header ON chunks
  FOR EACH ROW EXECUTE FUNCTION chunks_tsv_trigger();

-- Generic tsvector trigger for tables without contextual_header (video_chunks, audio_chunks)
CREATE OR REPLACE FUNCTION content_tsv_trigger() RETURNS TRIGGER AS $$
BEGIN
  NEW.content_tsv := to_tsvector('english', NEW.content);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Images (standalone photos + extracted from PDFs)
CREATE TABLE images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  dataset_id UUID REFERENCES datasets(id),
  filename TEXT,
  storage_path TEXT NOT NULL,
  file_type TEXT,
  file_size_bytes BIGINT,
  width INTEGER,
  height INTEGER,
  page_number INTEGER,
  description TEXT,
  ocr_text TEXT,
  visual_embedding VECTOR(1024),
  is_redacted BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Video transcripts
CREATE TABLE videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  dataset_id UUID REFERENCES datasets(id),
  filename TEXT,
  storage_path TEXT NOT NULL,
  duration_seconds INTEGER,
  transcript TEXT,
  transcript_language TEXT DEFAULT 'en',
  media_type TEXT DEFAULT 'video' CHECK (media_type IN ('video', 'audio', 'cctv')),
  processing_status TEXT DEFAULT 'pending',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Video transcript chunks (same embedding pattern as document chunks)
CREATE TABLE video_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  timestamp_start FLOAT,
  timestamp_end FLOAT,
  speaker_label TEXT,
  content_embedding VECTOR(1024),
  content_tsv TSVECTOR,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(video_id, chunk_index)
);

-- NOTE: Uses content_tsv_trigger (not chunks_tsv_trigger) because video_chunks has no contextual_header
CREATE TRIGGER video_chunks_tsv_update
  BEFORE INSERT OR UPDATE OF content ON video_chunks
  FOR EACH ROW EXECUTE FUNCTION content_tsv_trigger();

-- Processing job queue
CREATE TABLE processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id),
  job_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  priority INTEGER DEFAULT 0,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Step 5b: Create Migration 00002b — Data Sources Table

File: `supabase/migrations/00002b_data_sources.sql`

```sql
-- 00002b_data_sources.sql
-- Tracks ingestion status from all 24 community + official data sources.
-- Used by the Sources page and ingestion scripts.

CREATE TABLE data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  source_type TEXT NOT NULL,  -- 'github' | 'huggingface' | 'kaggle' | 'web' | 'archive' | 'torrent'
  url TEXT,
  data_type TEXT NOT NULL,    -- 'ocr' | 'embeddings' | 'entities' | 'chunks' | 'structured' | 'raw'
  status TEXT DEFAULT 'pending',  -- 'pending' | 'in_progress' | 'ingested' | 'partial' | 'failed' | 'unavailable'
  expected_count INTEGER,
  ingested_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  error_message TEXT,
  priority INTEGER DEFAULT 0,  -- higher = ingest first
  ingested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: public read
ALTER TABLE data_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON data_sources FOR SELECT USING (true);
```

### Step 6: Create Migration 00003 — Entity Tables

File: `supabase/migrations/00003_entity_tables.sql`

```sql
-- 00003_entity_tables.sql

CREATE TABLE entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  aliases TEXT[] DEFAULT '{}',
  description TEXT,
  name_embedding VECTOR(1024),
  first_seen_date TIMESTAMPTZ,
  last_seen_date TIMESTAMPTZ,
  mention_count INTEGER DEFAULT 0,
  document_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  source TEXT,               -- 'lmsband' | 'epstein-docs' | 'erikveland' | 'pipeline'
  name_normalized TEXT,      -- lowercase, stripped titles/honorifics, collapsed whitespace
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(name_normalized, entity_type)
);

CREATE TABLE entity_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  chunk_id UUID REFERENCES chunks(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  video_chunk_id UUID REFERENCES video_chunks(id) ON DELETE CASCADE,
  mention_text TEXT NOT NULL,
  context_snippet TEXT,
  mention_type TEXT DEFAULT 'direct',
  confidence FLOAT DEFAULT 1.0,
  page_number INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE entity_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_a_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  entity_b_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL,
  description TEXT,
  evidence_chunk_ids UUID[],
  evidence_document_ids UUID[],
  date_range TSTZRANGE,
  strength FLOAT DEFAULT 1.0,
  is_verified BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT no_self_relationship CHECK (entity_a_id != entity_b_id),
  UNIQUE(entity_a_id, entity_b_id, relationship_type)
);
```

### Step 7: Create Migration 00004 — Redaction Tables

File: `supabase/migrations/00004_redaction_tables.sql`

```sql
-- 00004_redaction_tables.sql

CREATE TABLE redactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_id UUID REFERENCES chunks(id) ON DELETE CASCADE,
  page_number INTEGER,
  redaction_type TEXT,
  char_length_estimate INTEGER,
  surrounding_text TEXT NOT NULL,
  sentence_template TEXT,
  context_embedding VECTOR(1024),
  co_occurring_entity_ids UUID[],
  document_date TIMESTAMPTZ,
  document_type TEXT,
  position_in_page JSONB,
  status TEXT DEFAULT 'unsolved',
  resolved_text TEXT,
  resolved_entity_id UUID REFERENCES entities(id),
  confidence FLOAT DEFAULT 0,
  resolved_at TIMESTAMPTZ,
  resolved_method TEXT,
  cascade_source_id UUID REFERENCES redactions(id),
  cascade_depth INTEGER DEFAULT 0,
  cascade_count INTEGER DEFAULT 0,
  potential_cascade_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE redaction_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  redaction_id UUID NOT NULL REFERENCES redactions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  proposed_text TEXT NOT NULL,
  proposed_entity_id UUID REFERENCES entities(id),
  evidence_type TEXT NOT NULL,
  evidence_description TEXT NOT NULL,
  evidence_sources TEXT[],
  supporting_chunk_ids UUID[],
  upvotes INTEGER DEFAULT 0,
  downvotes INTEGER DEFAULT 0,
  corroborations INTEGER DEFAULT 0,
  context_match_score FLOAT,
  length_match BOOLEAN,
  entity_graph_consistency FLOAT,
  composite_confidence FLOAT,
  status TEXT DEFAULT 'pending',
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  proposals_submitted INTEGER DEFAULT 0,
  proposals_confirmed INTEGER DEFAULT 0,
  cascades_triggered INTEGER DEFAULT 0,
  accuracy_rate FLOAT DEFAULT 0,
  reputation_score FLOAT DEFAULT 0,
  expertise_areas TEXT[],
  tier TEXT DEFAULT 'contributor',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE proposal_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES redaction_proposals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(proposal_id, user_id)
);
```

### Step 8: Create Migration 00005 — Timeline Tables

File: `supabase/migrations/00005_timeline_tables.sql`

```sql
-- 00005_timeline_tables.sql

CREATE TABLE timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_date TIMESTAMPTZ,
  date_precision TEXT DEFAULT 'exact',
  date_display TEXT,
  description TEXT NOT NULL,
  event_type TEXT NOT NULL,
  location TEXT,
  source_chunk_ids UUID[],
  source_document_ids UUID[],
  entity_ids UUID[],
  content_embedding VECTOR(1024),
  is_verified BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Step 8b: Create Migration 00005b — Flights Table

File: `supabase/migrations/00005b_flights.sql`

```sql
-- 00005b_flights.sql
-- Structured flight data from Archive.org flight logs, epsteinsblackbook.com,
-- and Epstein Exposed 1,700 flights. Generic timeline_events lacks flight-specific fields.

CREATE TABLE flights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_date DATE,
  departure TEXT,
  arrival TEXT,
  aircraft TEXT,
  tail_number TEXT,
  pilot TEXT,
  passenger_names TEXT[],
  passenger_entity_ids UUID[],
  source TEXT,               -- 'archive_org' | 'blackbook' | 'epstein_exposed' | 'pipeline'
  raw_text TEXT,
  document_id UUID REFERENCES documents(id),
  page_number INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE flights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON flights FOR SELECT USING (true);

CREATE INDEX idx_flights_date ON flights (flight_date);
CREATE INDEX idx_flights_passengers ON flights USING gin (passenger_names);
```

### Step 9: Create Migration 00006 — User Feature Tables

File: `supabase/migrations/00006_user_tables.sql`

```sql
-- 00006_user_tables.sql

CREATE TABLE saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  filters JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
  chunk_id UUID REFERENCES chunks(id) ON DELETE CASCADE,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT NOT NULL,
  title TEXT,
  messages JSONB DEFAULT '[]',
  model_tier TEXT DEFAULT 'free',
  message_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Step 10: Create Migration 00007 — Search Functions

File: `supabase/migrations/00007_search_functions.sql`

```sql
-- 00007_search_functions.sql

-- Hybrid search with Reciprocal Rank Fusion (text chunks)
CREATE OR REPLACE FUNCTION hybrid_search_chunks_rrf(
  query_text TEXT,
  query_embedding VECTOR(1024),
  match_count INTEGER DEFAULT 20,
  rrf_k INTEGER DEFAULT 60,
  dataset_filter UUID DEFAULT NULL,
  doc_type_filter TEXT DEFAULT NULL,
  date_from TIMESTAMPTZ DEFAULT NULL,
  date_to TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  chunk_id UUID,
  document_id UUID,
  content TEXT,
  contextual_header TEXT,
  page_number INTEGER,
  section_title TEXT,
  document_filename TEXT,
  document_classification TEXT,
  dataset_name TEXT,
  rrf_score FLOAT,
  semantic_rank INTEGER,
  keyword_rank INTEGER
)
LANGUAGE sql STABLE
AS $$
  WITH semantic_search AS (
    SELECT
      c.id,
      c.document_id,
      c.content,
      c.contextual_header,
      c.page_number,
      c.section_title,
      ROW_NUMBER() OVER (ORDER BY c.content_embedding <=> query_embedding) AS rank
    FROM chunks c
    JOIN documents d ON d.id = c.document_id
    WHERE c.content_embedding IS NOT NULL
      AND (dataset_filter IS NULL OR d.dataset_id = dataset_filter)
      AND (doc_type_filter IS NULL OR d.classification = doc_type_filter)
      AND (date_from IS NULL OR d.date_extracted >= date_from)
      AND (date_to IS NULL OR d.date_extracted <= date_to)
    ORDER BY c.content_embedding <=> query_embedding
    LIMIT match_count * 2
  ),
  keyword_search AS (
    SELECT
      c.id,
      c.document_id,
      c.content,
      c.contextual_header,
      c.page_number,
      c.section_title,
      ROW_NUMBER() OVER (ORDER BY ts_rank_cd(c.content_tsv, plainto_tsquery('english', query_text)) DESC) AS rank
    FROM chunks c
    JOIN documents d ON d.id = c.document_id
    WHERE c.content_tsv @@ plainto_tsquery('english', query_text)
      AND (dataset_filter IS NULL OR d.dataset_id = dataset_filter)
      AND (doc_type_filter IS NULL OR d.classification = doc_type_filter)
      AND (date_from IS NULL OR d.date_extracted >= date_from)
      AND (date_to IS NULL OR d.date_extracted <= date_to)
    ORDER BY ts_rank_cd(c.content_tsv, plainto_tsquery('english', query_text)) DESC
    LIMIT match_count * 2
  )
  SELECT
    COALESCE(s.id, k.id) AS chunk_id,
    COALESCE(s.document_id, k.document_id) AS document_id,
    COALESCE(s.content, k.content) AS content,
    COALESCE(s.contextual_header, k.contextual_header) AS contextual_header,
    COALESCE(s.page_number, k.page_number) AS page_number,
    COALESCE(s.section_title, k.section_title) AS section_title,
    d.filename AS document_filename,
    d.classification AS document_classification,
    ds.name AS dataset_name,
    (COALESCE(1.0 / (rrf_k + s.rank), 0.0) + COALESCE(1.0 / (rrf_k + k.rank), 0.0))::FLOAT AS rrf_score,
    s.rank::INTEGER AS semantic_rank,
    k.rank::INTEGER AS keyword_rank
  FROM semantic_search s
  FULL OUTER JOIN keyword_search k ON s.id = k.id
  JOIN documents d ON d.id = COALESCE(s.document_id, k.document_id)
  LEFT JOIN datasets ds ON ds.id = d.dataset_id
  ORDER BY rrf_score DESC
  LIMIT match_count;
$$;

-- Multimodal search across documents, images, video, and audio
-- Uses unified Nova 1024d embeddings — one query vector searches all modalities
CREATE OR REPLACE FUNCTION multimodal_search_rrf(
  query_text TEXT,
  query_embedding VECTOR(1024),
  match_count INTEGER DEFAULT 20,
  rrf_k INTEGER DEFAULT 60,
  search_documents BOOLEAN DEFAULT true,
  search_images BOOLEAN DEFAULT true,
  search_videos BOOLEAN DEFAULT true,
  search_audio BOOLEAN DEFAULT true,
  dataset_filter UUID DEFAULT NULL
)
RETURNS TABLE (
  result_id UUID,
  source_type TEXT,
  content TEXT,
  document_id UUID,
  page_number INTEGER,
  storage_path TEXT,
  filename TEXT,
  dataset_name TEXT,
  rrf_score FLOAT
)
LANGUAGE sql STABLE
AS $$
  WITH doc_semantic AS (
    SELECT c.id AS result_id, 'document'::TEXT AS source_type,
           c.content, c.document_id, c.page_number,
           NULL::TEXT AS storage_path, d.filename, ds.name AS dataset_name,
           ROW_NUMBER() OVER (ORDER BY c.content_embedding <=> query_embedding) AS rank
    FROM chunks c
    JOIN documents d ON d.id = c.document_id
    LEFT JOIN datasets ds ON ds.id = d.dataset_id
    WHERE search_documents AND c.content_embedding IS NOT NULL
      AND (dataset_filter IS NULL OR d.dataset_id = dataset_filter)
    ORDER BY c.content_embedding <=> query_embedding
    LIMIT match_count
  ),
  img_semantic AS (
    SELECT i.id AS result_id, 'image'::TEXT AS source_type,
           COALESCE(i.description, i.ocr_text, 'Image') AS content,
           i.document_id, i.page_number,
           i.storage_path, i.filename, ds.name AS dataset_name,
           ROW_NUMBER() OVER (ORDER BY i.visual_embedding <=> query_embedding) AS rank
    FROM images i
    LEFT JOIN datasets ds ON ds.id = i.dataset_id
    WHERE search_images AND i.visual_embedding IS NOT NULL
      AND (dataset_filter IS NULL OR i.dataset_id = dataset_filter)
    ORDER BY i.visual_embedding <=> query_embedding
    LIMIT match_count
  ),
  vid_semantic AS (
    SELECT vc.id AS result_id, 'video'::TEXT AS source_type,
           vc.content, v.document_id, NULL::INTEGER AS page_number,
           v.storage_path, v.filename, ds.name AS dataset_name,
           ROW_NUMBER() OVER (ORDER BY vc.content_embedding <=> query_embedding) AS rank
    FROM video_chunks vc
    JOIN videos v ON v.id = vc.video_id
    LEFT JOIN datasets ds ON ds.id = v.dataset_id
    WHERE search_videos AND vc.content_embedding IS NOT NULL
      AND (dataset_filter IS NULL OR v.dataset_id = dataset_filter)
    ORDER BY vc.content_embedding <=> query_embedding
    LIMIT match_count
  ),
  audio_semantic AS (
    SELECT ac.id AS result_id, 'audio'::TEXT AS source_type,
           ac.content, af.document_id, NULL::INTEGER AS page_number,
           af.storage_path, af.filename, ds.name AS dataset_name,
           ROW_NUMBER() OVER (ORDER BY ac.content_embedding <=> query_embedding) AS rank
    FROM audio_chunks ac
    JOIN audio_files af ON af.id = ac.audio_id
    LEFT JOIN datasets ds ON ds.id = af.dataset_id
    WHERE search_audio AND ac.content_embedding IS NOT NULL
      AND (dataset_filter IS NULL OR af.dataset_id = dataset_filter)
    ORDER BY ac.content_embedding <=> query_embedding
    LIMIT match_count
  ),
  all_results AS (
    SELECT *, 1.0 / (rrf_k + rank) AS score FROM doc_semantic
    UNION ALL
    SELECT *, 1.0 / (rrf_k + rank) AS score FROM img_semantic
    UNION ALL
    SELECT *, 1.0 / (rrf_k + rank) AS score FROM vid_semantic
    UNION ALL
    SELECT *, 1.0 / (rrf_k + rank) AS score FROM audio_semantic
  )
  SELECT result_id, source_type, content, document_id, page_number,
         storage_path, filename, dataset_name, score::FLOAT AS rrf_score
  FROM all_results
  ORDER BY score DESC
  LIMIT match_count;
$$;

-- Find similar redactions by context (for cascade engine)
CREATE OR REPLACE FUNCTION find_similar_redactions(
  source_redaction_id UUID,
  similarity_threshold FLOAT DEFAULT 0.80,
  match_count INTEGER DEFAULT 50
)
RETURNS TABLE (
  redaction_id UUID,
  similarity FLOAT,
  surrounding_text TEXT,
  document_id UUID,
  page_number INTEGER,
  char_length_estimate INTEGER
)
LANGUAGE sql STABLE
AS $$
  SELECT
    r.id AS redaction_id,
    1 - (r.context_embedding <=> src.context_embedding)::FLOAT AS similarity,
    r.surrounding_text,
    r.document_id,
    r.page_number,
    r.char_length_estimate
  FROM redactions r
  CROSS JOIN (SELECT context_embedding, char_length_estimate, redaction_type FROM redactions WHERE id = source_redaction_id) src
  WHERE r.id != source_redaction_id
    AND r.status = 'unsolved'
    AND r.context_embedding IS NOT NULL
    AND 1 - (r.context_embedding <=> src.context_embedding) >= similarity_threshold
    AND (src.char_length_estimate IS NULL OR ABS(r.char_length_estimate - src.char_length_estimate) <= 3)
    AND (src.redaction_type IS NULL OR r.redaction_type = src.redaction_type)
  ORDER BY similarity DESC
  LIMIT match_count;
$$;
```

### Step 11: Create Migration 00008 — Entity Functions

File: `supabase/migrations/00008_entity_functions.sql`

```sql
-- 00008_entity_functions.sql

-- BFS connection graph from a starting entity
CREATE OR REPLACE FUNCTION get_entity_connection_graph(
  start_entity_id UUID,
  max_depth INTEGER DEFAULT 2,
  max_nodes INTEGER DEFAULT 50
)
RETURNS TABLE (
  entity_id UUID,
  entity_name TEXT,
  entity_type TEXT,
  mention_count INTEGER,
  depth INTEGER,
  connected_from UUID,
  relationship_type TEXT,
  relationship_strength FLOAT
)
LANGUAGE sql STABLE
AS $$
  WITH RECURSIVE graph AS (
    -- Base case: the starting entity
    SELECT
      e.id AS entity_id,
      e.name AS entity_name,
      e.entity_type,
      e.mention_count,
      0 AS depth,
      NULL::UUID AS connected_from,
      NULL::TEXT AS relationship_type,
      NULL::FLOAT AS relationship_strength
    FROM entities e
    WHERE e.id = start_entity_id

    UNION ALL

    -- Recursive case: follow relationships in both directions
    SELECT
      CASE WHEN er.entity_a_id = g.entity_id THEN er.entity_b_id ELSE er.entity_a_id END AS entity_id,
      e.name AS entity_name,
      e.entity_type,
      e.mention_count,
      g.depth + 1 AS depth,
      g.entity_id AS connected_from,
      er.relationship_type,
      er.strength AS relationship_strength
    FROM graph g
    JOIN entity_relationships er
      ON er.entity_a_id = g.entity_id OR er.entity_b_id = g.entity_id
    JOIN entities e
      ON e.id = CASE WHEN er.entity_a_id = g.entity_id THEN er.entity_b_id ELSE er.entity_a_id END
    WHERE g.depth < max_depth
  )
  SELECT DISTINCT ON (graph.entity_id)
    graph.entity_id,
    graph.entity_name,
    graph.entity_type,
    graph.mention_count,
    graph.depth,
    graph.connected_from,
    graph.relationship_type,
    graph.relationship_strength
  FROM graph
  ORDER BY graph.entity_id, graph.depth ASC
  LIMIT max_nodes;
$$;

-- Search entities by name embedding (vector similarity)
CREATE OR REPLACE FUNCTION search_entities_by_embedding(
  query_embedding VECTOR(1024),
  match_count INTEGER DEFAULT 20
)
RETURNS TABLE (
  entity_id UUID,
  entity_name TEXT,
  entity_type TEXT,
  aliases TEXT[],
  mention_count INTEGER,
  document_count INTEGER,
  similarity FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    e.id AS entity_id,
    e.name AS entity_name,
    e.entity_type,
    e.aliases,
    e.mention_count,
    e.document_count,
    1 - (e.name_embedding <=> query_embedding)::FLOAT AS similarity
  FROM entities e
  WHERE e.name_embedding IS NOT NULL
  ORDER BY e.name_embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Entity mention aggregation by document
CREATE OR REPLACE FUNCTION get_entity_mention_stats(
  target_entity_id UUID
)
RETURNS TABLE (
  document_id UUID,
  document_filename TEXT,
  document_classification TEXT,
  dataset_name TEXT,
  mention_count BIGINT,
  mention_types TEXT[],
  first_mention TIMESTAMPTZ,
  last_mention TIMESTAMPTZ
)
LANGUAGE sql STABLE
AS $$
  SELECT
    em.document_id,
    d.filename AS document_filename,
    d.classification AS document_classification,
    ds.name AS dataset_name,
    COUNT(*) AS mention_count,
    ARRAY_AGG(DISTINCT em.mention_type) AS mention_types,
    MIN(em.created_at) AS first_mention,
    MAX(em.created_at) AS last_mention
  FROM entity_mentions em
  JOIN documents d ON d.id = em.document_id
  LEFT JOIN datasets ds ON ds.id = d.dataset_id
  WHERE em.entity_id = target_entity_id
  GROUP BY em.document_id, d.filename, d.classification, ds.name
  ORDER BY mention_count DESC;
$$;

-- Search entities by name (trigram fuzzy match)
CREATE OR REPLACE FUNCTION search_entities_by_name(
  search_query TEXT,
  match_count INTEGER DEFAULT 20
)
RETURNS TABLE (
  entity_id UUID,
  entity_name TEXT,
  entity_type TEXT,
  aliases TEXT[],
  mention_count INTEGER,
  document_count INTEGER,
  similarity FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    e.id AS entity_id,
    e.name AS entity_name,
    e.entity_type,
    e.aliases,
    e.mention_count,
    e.document_count,
    similarity(e.name, search_query)::FLOAT AS similarity
  FROM entities e
  WHERE e.name % search_query
     OR search_query % ANY(e.aliases)
  ORDER BY similarity(e.name, search_query) DESC
  LIMIT match_count;
$$;
```

### Step 12: Create Migration 00009 — Redaction Functions

File: `supabase/migrations/00009_redaction_functions.sql`

```sql
-- 00009_redaction_functions.sql

-- Get solvable redactions sorted by cascade impact
CREATE OR REPLACE FUNCTION get_solvable_redactions(
  limit_count INTEGER DEFAULT 50,
  offset_count INTEGER DEFAULT 0,
  status_filter TEXT DEFAULT 'unsolved',
  type_filter TEXT DEFAULT NULL,
  dataset_filter UUID DEFAULT NULL
)
RETURNS TABLE (
  redaction_id UUID,
  document_id UUID,
  document_filename TEXT,
  dataset_name TEXT,
  page_number INTEGER,
  redaction_type TEXT,
  char_length_estimate INTEGER,
  surrounding_text TEXT,
  sentence_template TEXT,
  status TEXT,
  potential_cascade_count INTEGER,
  proposal_count BIGINT,
  top_proposal_confidence FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    r.id AS redaction_id,
    r.document_id,
    d.filename AS document_filename,
    ds.name AS dataset_name,
    r.page_number,
    r.redaction_type,
    r.char_length_estimate,
    r.surrounding_text,
    r.sentence_template,
    r.status,
    r.potential_cascade_count,
    COUNT(rp.id) AS proposal_count,
    MAX(rp.composite_confidence) AS top_proposal_confidence
  FROM redactions r
  JOIN documents d ON d.id = r.document_id
  LEFT JOIN datasets ds ON ds.id = d.dataset_id
  LEFT JOIN redaction_proposals rp ON rp.redaction_id = r.id AND rp.status = 'pending'
  WHERE r.status = status_filter
    AND (type_filter IS NULL OR r.redaction_type = type_filter)
    AND (dataset_filter IS NULL OR d.dataset_id = dataset_filter)
  GROUP BY r.id, r.document_id, d.filename, ds.name, r.page_number,
           r.redaction_type, r.char_length_estimate, r.surrounding_text,
           r.sentence_template, r.status, r.potential_cascade_count
  ORDER BY r.potential_cascade_count DESC NULLS LAST
  LIMIT limit_count
  OFFSET offset_count;
$$;

-- Get cascade tree (recursive CTE following cascade_source_id)
CREATE OR REPLACE FUNCTION get_cascade_tree(
  root_redaction_id UUID
)
RETURNS TABLE (
  redaction_id UUID,
  parent_id UUID,
  resolved_text TEXT,
  resolved_entity_name TEXT,
  document_filename TEXT,
  page_number INTEGER,
  cascade_depth INTEGER,
  resolved_at TIMESTAMPTZ
)
LANGUAGE sql STABLE
AS $$
  WITH RECURSIVE tree AS (
    -- Root node
    SELECT
      r.id AS redaction_id,
      r.cascade_source_id AS parent_id,
      r.resolved_text,
      e.name AS resolved_entity_name,
      d.filename AS document_filename,
      r.page_number,
      0 AS cascade_depth,
      r.resolved_at
    FROM redactions r
    LEFT JOIN entities e ON e.id = r.resolved_entity_id
    JOIN documents d ON d.id = r.document_id
    WHERE r.id = root_redaction_id

    UNION ALL

    -- Children (redactions that cascaded from parent)
    SELECT
      r.id AS redaction_id,
      r.cascade_source_id AS parent_id,
      r.resolved_text,
      e.name AS resolved_entity_name,
      d.filename AS document_filename,
      r.page_number,
      t.cascade_depth + 1,
      r.resolved_at
    FROM redactions r
    JOIN tree t ON r.cascade_source_id = t.redaction_id
    LEFT JOIN entities e ON e.id = r.resolved_entity_id
    JOIN documents d ON d.id = r.document_id
    WHERE r.status IN ('confirmed', 'corroborated')
  )
  SELECT * FROM tree
  ORDER BY cascade_depth, resolved_at;
$$;

-- Get redaction statistics
CREATE OR REPLACE FUNCTION get_redaction_stats()
RETURNS TABLE (
  total_redactions BIGINT,
  unsolved BIGINT,
  proposed BIGINT,
  corroborated BIGINT,
  confirmed BIGINT,
  disputed BIGINT,
  total_cascades BIGINT,
  avg_cascade_depth FLOAT,
  total_proposals BIGINT,
  total_contributors BIGINT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    COUNT(*) AS total_redactions,
    COUNT(*) FILTER (WHERE status = 'unsolved') AS unsolved,
    COUNT(*) FILTER (WHERE status = 'proposed') AS proposed,
    COUNT(*) FILTER (WHERE status = 'corroborated') AS corroborated,
    COUNT(*) FILTER (WHERE status = 'confirmed') AS confirmed,
    COUNT(*) FILTER (WHERE status = 'disputed') AS disputed,
    COALESCE(SUM(cascade_count), 0) AS total_cascades,
    COALESCE(AVG(cascade_depth) FILTER (WHERE cascade_depth > 0), 0)::FLOAT AS avg_cascade_depth,
    (SELECT COUNT(*) FROM redaction_proposals) AS total_proposals,
    (SELECT COUNT(DISTINCT user_id) FROM redaction_proposals) AS total_contributors
  FROM redactions;
$$;

-- Calculate proposal confidence score (weighted combination)
CREATE OR REPLACE FUNCTION calculate_proposal_confidence(
  target_proposal_id UUID
)
RETURNS FLOAT
LANGUAGE plpgsql
AS $$
DECLARE
  proposal RECORD;
  confidence FLOAT := 0;
  vote_score FLOAT;
  length_bonus FLOAT;
  context_bonus FLOAT;
  graph_bonus FLOAT;
BEGIN
  SELECT rp.*, r.char_length_estimate
  INTO proposal
  FROM redaction_proposals rp
  JOIN redactions r ON r.id = rp.redaction_id
  WHERE rp.id = target_proposal_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Vote score (0-0.3): community agreement
  vote_score := LEAST(
    (COALESCE(proposal.upvotes, 0) + COALESCE(proposal.corroborations, 0) * 2 - COALESCE(proposal.downvotes, 0))::FLOAT
    / GREATEST(COALESCE(proposal.upvotes, 0) + COALESCE(proposal.downvotes, 0) + COALESCE(proposal.corroborations, 0), 1)::FLOAT,
    1.0
  ) * 0.3;

  -- Length match bonus (0 or 0.15)
  IF proposal.char_length_estimate IS NOT NULL AND proposal.length_match THEN
    length_bonus := 0.15;
  ELSE
    length_bonus := 0;
  END IF;

  -- Context match score (0-0.35)
  context_bonus := COALESCE(proposal.context_match_score, 0) * 0.35;

  -- Entity graph consistency (0-0.20)
  graph_bonus := COALESCE(proposal.entity_graph_consistency, 0) * 0.20;

  confidence := vote_score + length_bonus + context_bonus + graph_bonus;

  -- Update the proposal
  UPDATE redaction_proposals
  SET composite_confidence = confidence
  WHERE id = target_proposal_id;

  RETURN confidence;
END;
$$;
```

### Step 13: Create Migration 00010 — Indexes

File: `supabase/migrations/00010_indexes.sql`

```sql
-- 00010_indexes.sql

-- HNSW indexes (better recall than IVFFlat, works on empty tables)
-- All embeddings are 1024d Nova vectors in a unified space
CREATE INDEX idx_chunks_embedding ON chunks USING hnsw (content_embedding vector_cosine_ops);
CREATE INDEX idx_images_visual_emb ON images USING hnsw (visual_embedding vector_cosine_ops);
CREATE INDEX idx_entities_name_emb ON entities USING hnsw (name_embedding vector_cosine_ops);
CREATE INDEX idx_redactions_embedding ON redactions USING hnsw (context_embedding vector_cosine_ops);
CREATE INDEX idx_timeline_embedding ON timeline_events USING hnsw (content_embedding vector_cosine_ops);
CREATE INDEX idx_video_chunks_embedding ON video_chunks USING hnsw (content_embedding vector_cosine_ops);

-- GIN indexes (full-text search + trigram)
CREATE INDEX idx_chunks_tsv ON chunks USING gin (content_tsv);
CREATE INDEX idx_entities_name_trgm ON entities USING gin (name gin_trgm_ops);
CREATE INDEX idx_video_chunks_tsv ON video_chunks USING gin (content_tsv);

-- B-tree indexes (lookups, sorting, joins)
CREATE INDEX idx_chunks_document_id ON chunks (document_id);
CREATE INDEX idx_entity_mentions_entity ON entity_mentions (entity_id);
CREATE INDEX idx_entity_mentions_document ON entity_mentions (document_id);
-- Prevent duplicate mentions from concurrent entity extraction (race condition safeguard)
CREATE UNIQUE INDEX idx_entity_mentions_unique ON entity_mentions (document_id, entity_id, chunk_id) WHERE chunk_id IS NOT NULL;
CREATE INDEX idx_entity_relationships_a ON entity_relationships (entity_a_id);
CREATE INDEX idx_entity_relationships_b ON entity_relationships (entity_b_id);
CREATE INDEX idx_redactions_status ON redactions (status);
CREATE INDEX idx_redactions_document ON redactions (document_id);
CREATE INDEX idx_timeline_date ON timeline_events (event_date);
CREATE INDEX idx_processing_jobs_status ON processing_jobs (status, priority DESC);
CREATE INDEX idx_documents_dataset ON documents (dataset_id);
CREATE INDEX idx_documents_classification ON documents (classification);
```

### Step 14: Create Migration 00011 — RLS Policies

File: `supabase/migrations/00011_rls_policies.sql`

```sql
-- 00011_rls_policies.sql
-- Row Level Security for all tables.
-- Pattern: public read for content tables, auth write for user-generated data, service role bypasses RLS by default.

-- ═══════════════════════════════════════
-- PUBLIC READ-ONLY TABLES (content)
-- ═══════════════════════════════════════

ALTER TABLE datasets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON datasets FOR SELECT USING (true);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON documents FOR SELECT USING (true);

ALTER TABLE chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON chunks FOR SELECT USING (true);

ALTER TABLE images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON images FOR SELECT USING (true);

ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON videos FOR SELECT USING (true);

ALTER TABLE video_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON video_chunks FOR SELECT USING (true);

ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON entities FOR SELECT USING (true);

ALTER TABLE entity_mentions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON entity_mentions FOR SELECT USING (true);

ALTER TABLE entity_relationships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON entity_relationships FOR SELECT USING (true);

ALTER TABLE redactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON redactions FOR SELECT USING (true);

ALTER TABLE timeline_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON timeline_events FOR SELECT USING (true);

ALTER TABLE processing_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON processing_jobs FOR SELECT USING (true);

-- ═══════════════════════════════════════
-- USER PROFILES (read all, update own)
-- ═══════════════════════════════════════

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON user_profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ═══════════════════════════════════════
-- REDACTION PROPOSALS (public read, auth insert/update own)
-- ═══════════════════════════════════════

ALTER TABLE redaction_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON redaction_proposals FOR SELECT USING (true);
CREATE POLICY "Auth users can submit proposals" ON redaction_proposals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own proposals" ON redaction_proposals FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ═══════════════════════════════════════
-- PROPOSAL VOTES (public read, auth insert own, unique enforced at DB level)
-- ═══════════════════════════════════════

ALTER TABLE proposal_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON proposal_votes FOR SELECT USING (true);
CREATE POLICY "Auth users can vote" ON proposal_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own votes" ON proposal_votes FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own votes" ON proposal_votes FOR DELETE USING (auth.uid() = user_id);

-- ═══════════════════════════════════════
-- SAVED SEARCHES (auth own only)
-- ═══════════════════════════════════════

ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own saved searches" ON saved_searches FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own saved searches" ON saved_searches FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own saved searches" ON saved_searches FOR DELETE USING (auth.uid() = user_id);

-- ═══════════════════════════════════════
-- BOOKMARKS (auth own only)
-- ═══════════════════════════════════════

ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own bookmarks" ON bookmarks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own bookmarks" ON bookmarks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own bookmarks" ON bookmarks FOR DELETE USING (auth.uid() = user_id);

-- ═══════════════════════════════════════
-- CHAT CONVERSATIONS (auth own only, anonymous by session handled in API)
-- ═══════════════════════════════════════

ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own conversations" ON chat_conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own conversations" ON chat_conversations FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Users can update own conversations" ON chat_conversations FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

### Step 15: Create Migration 00012 — Stats Views

File: `supabase/migrations/00012_stats_views.sql`

```sql
-- 00012_stats_views.sql

CREATE MATERIALIZED VIEW corpus_stats AS
SELECT
  (SELECT COUNT(*) FROM documents) AS total_documents,
  (SELECT COUNT(*) FROM documents WHERE processing_status = 'complete') AS processed_documents,
  (SELECT COUNT(*) FROM documents WHERE ocr_source IS NOT NULL AND ocr_source != 'pipeline') AS community_ocr_documents,
  (SELECT SUM(page_count) FROM documents) AS total_pages,
  (SELECT COUNT(*) FROM chunks) AS total_chunks,
  (SELECT COUNT(*) FROM chunks WHERE embedding_model = 'amazon.nova-multimodal-embeddings-v1:0') AS target_model_chunks,
  (SELECT COUNT(*) FROM chunks WHERE embedding_model IS NOT NULL AND embedding_model != 'amazon.nova-multimodal-embeddings-v1:0') AS community_model_chunks,
  (SELECT COUNT(*) FROM images) AS total_images,
  (SELECT COUNT(*) FROM videos) AS total_videos,
  (SELECT COUNT(*) FROM entities) AS total_entities,
  (SELECT COUNT(*) FROM entities WHERE source IS NOT NULL AND source != 'pipeline') AS community_entities,
  (SELECT COUNT(*) FROM entity_relationships) AS total_relationships,
  (SELECT COUNT(*) FROM redactions) AS total_redactions,
  (SELECT COUNT(*) FROM redactions WHERE status = 'confirmed') AS solved_redactions,
  (SELECT COUNT(*) FROM redactions WHERE status = 'corroborated') AS corroborated_redactions,
  (SELECT COUNT(*) FROM redaction_proposals) AS total_proposals,
  (SELECT COUNT(DISTINCT user_id) FROM redaction_proposals) AS total_contributors,
  (SELECT COUNT(*) FROM flights) AS total_flights,
  (SELECT COUNT(*) FROM data_sources WHERE status = 'ingested') AS sources_ingested,
  (SELECT COUNT(*) FROM data_sources) AS sources_total;
-- Refresh periodically: REFRESH MATERIALIZED VIEW corpus_stats;
```

### Step 16: Create Migration 00013 — Funding Tables

File: `supabase/migrations/00013_funding_tables.sql`

```sql
-- 00013_funding_tables.sql

CREATE TABLE funding_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gofundme_url TEXT,
  goal_amount NUMERIC NOT NULL DEFAULT 16000,
  raised_amount NUMERIC NOT NULL DEFAULT 0,
  donor_count INTEGER DEFAULT 0,
  last_synced_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default row
INSERT INTO funding_status (gofundme_url, goal_amount, raised_amount, donor_count)
VALUES ('https://www.gofundme.com/f/the-epstein-archive', 16000, 0, 0);

CREATE TABLE processing_spend_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount NUMERIC NOT NULL,
  service TEXT NOT NULL,
  description TEXT NOT NULL,
  pages_processed INTEGER,
  chunks_created INTEGER,
  entities_extracted INTEGER,
  redactions_detected INTEGER,
  images_processed INTEGER,
  dataset_id UUID REFERENCES datasets(id),
  triggered_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE donation_impact_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount NUMERIC NOT NULL,
  label TEXT NOT NULL,
  description TEXT NOT NULL,
  pages_processed INTEGER,
  entities_extracted INTEGER,
  analogy TEXT,
  sort_order INTEGER DEFAULT 0
);

-- Seed the 10 donation impact tiers
INSERT INTO donation_impact_tiers (amount, label, description, pages_processed, entities_extracted, analogy, sort_order) VALUES
  (1, '$1', 'A small stack of FBI interview summaries', 475, 10, 'About the size of a paperback novel', 1),
  (5, '$5', 'A full deposition transcript', 2400, 50, 'One person''s entire testimony under oath', 2),
  (10, '$10', 'A batch of flight logs spanning several months', 4750, 100, 'Every passenger who flew on the Lolita Express for a quarter', 3),
  (25, '$25', 'An entire FBI case subfolder', 12000, 250, 'More pages than the entire 9/11 Commission Report', 4),
  (50, '$50', 'A major court proceeding with all exhibits', 24000, 500, 'The complete legal record of one Epstein case', 5),
  (100, '$100', 'Half of a small DOJ dataset', 48000, 1000, 'Enough to surface ~500 entity connections the public has never seen', 6),
  (250, '$250', 'An entire mid-sized dataset', 119000, 2500, 'Processing a whole filing cabinet of evidence', 7),
  (500, '$500', 'A large dataset with full entity extraction', 238000, 5000, 'More pages than every Harry Potter book combined — times ten', 8),
  (1500, '$1,500', '20% of the entire corpus', 714000, 15000, 'One-fifth of everything the DOJ released', 9),
  (5000, '$5,000', 'Two-thirds of the entire corpus', 2380000, 50000, 'Most of the truth, searchable in weeks', 10);

-- RLS for funding tables
ALTER TABLE funding_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON funding_status FOR SELECT USING (true);

ALTER TABLE processing_spend_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON processing_spend_log FOR SELECT USING (true);

ALTER TABLE donation_impact_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON donation_impact_tiers FOR SELECT USING (true);
```

### Step 17: Create Migration 00014 — Contribution Tables

File: `supabase/migrations/00014_contribution_tables.sql`

```sql
-- 00014_contribution_tables.sql

CREATE TABLE image_match_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  submitted_image_path TEXT NOT NULL,
  submitted_image_embedding VECTOR(1024),
  source_description TEXT NOT NULL,
  source_url TEXT,
  matched_image_id UUID REFERENCES images(id),
  similarity_score FLOAT,
  status TEXT DEFAULT 'pending',
  revealed_entities UUID[],
  revealed_description TEXT,
  upvotes INTEGER DEFAULT 0,
  downvotes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE intelligence_hints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hint_type TEXT NOT NULL,
  entity_name TEXT,
  entity_type TEXT,
  aliases TEXT[],
  known_associations TEXT[],
  associated_entity_ids UUID[],
  description TEXT NOT NULL,
  verbatim_quote TEXT,
  source_type TEXT NOT NULL,
  source_url TEXT,
  source_date TIMESTAMPTZ,
  source_description TEXT,
  status TEXT DEFAULT 'pending',
  created_entity_id UUID REFERENCES entities(id),
  redactions_matched INTEGER DEFAULT 0,
  hint_embedding VECTOR(1024),
  upvotes INTEGER DEFAULT 0,
  downvotes INTEGER DEFAULT 0,
  corroborations INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE contribution_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contribution_type TEXT NOT NULL,
  target_id UUID,
  target_type TEXT,
  description TEXT,
  xp_earned INTEGER DEFAULT 0,
  cascades_triggered INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for contribution tables
ALTER TABLE image_match_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON image_match_submissions FOR SELECT USING (true);
CREATE POLICY "Auth users can submit image matches" ON image_match_submissions FOR INSERT WITH CHECK (auth.uid() = user_id);

ALTER TABLE intelligence_hints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON intelligence_hints FOR SELECT USING (true);
CREATE POLICY "Auth users can submit hints" ON intelligence_hints FOR INSERT WITH CHECK (auth.uid() = user_id);

ALTER TABLE contribution_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON contribution_activity FOR SELECT USING (true);
CREATE POLICY "Auth users can insert own activity" ON contribution_activity FOR INSERT WITH CHECK (auth.uid() = user_id);
```

### Step 18: Create Migration 00015 — Gamification Tables

File: `supabase/migrations/00015_gamification_tables.sql`

```sql
-- 00015_gamification_tables.sql

-- Add gamification columns to user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS level_title TEXT DEFAULT 'Observer';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS longest_streak INTEGER DEFAULT 0;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS last_contribution_date DATE;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS total_cascades_triggered INTEGER DEFAULT 0;

-- Achievement definitions (seeded at deploy time)
CREATE TABLE achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  category TEXT NOT NULL,
  requirement_type TEXT NOT NULL,
  requirement_value INTEGER,
  xp_reward INTEGER DEFAULT 0,
  rarity TEXT DEFAULT 'common',
  sort_order INTEGER DEFAULT 0
);

-- User achievements (earned badges)
CREATE TABLE user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ DEFAULT now(),
  trigger_contribution_id UUID,
  UNIQUE(user_id, achievement_id)
);

-- XP transaction log (every XP change)
CREATE TABLE xp_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  contribution_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Weekly leaderboard snapshot (materialized for performance)
CREATE MATERIALIZED VIEW weekly_leaderboard AS
SELECT
  up.id AS user_id,
  up.display_name,
  up.avatar_url,
  up.level,
  up.level_title,
  COALESCE(SUM(xt.amount), 0) AS weekly_xp,
  up.xp AS total_xp,
  up.total_cascades_triggered,
  COUNT(DISTINCT ua.achievement_id) AS achievement_count
FROM user_profiles up
LEFT JOIN xp_transactions xt ON xt.user_id = up.id
  AND xt.created_at >= now() - INTERVAL '7 days'
LEFT JOIN user_achievements ua ON ua.user_id = up.id
GROUP BY up.id, up.display_name, up.avatar_url, up.level, up.level_title, up.xp, up.total_cascades_triggered
ORDER BY weekly_xp DESC;

-- RLS for gamification tables
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON achievements FOR SELECT USING (true);

ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON user_achievements FOR SELECT USING (true);
CREATE POLICY "System can insert achievements" ON user_achievements FOR INSERT WITH CHECK (auth.uid() = user_id);

ALTER TABLE xp_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own XP transactions" ON xp_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can insert XP transactions" ON xp_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Index for XP transaction queries
CREATE INDEX idx_xp_transactions_user ON xp_transactions (user_id, created_at DESC);
CREATE INDEX idx_user_achievements_user ON user_achievements (user_id);
```

### Step 19: Create Migration 00016 — Collaborative Research Tables

File: `supabase/migrations/00016_collaborative_research_tables.sql`

```sql
-- 00016_collaborative_research_tables.sql

-- Per-paragraph margin notes on documents
CREATE TABLE annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_id UUID REFERENCES chunks(id) ON DELETE CASCADE,
  page_number INTEGER,
  content TEXT NOT NULL,
  annotation_type TEXT NOT NULL DEFAULT 'observation',
  parent_id UUID REFERENCES annotations(id) ON DELETE CASCADE,
  upvotes INTEGER DEFAULT 0,
  downvotes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Collaborative case files
CREATE TABLE investigation_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active',
  is_public BOOLEAN DEFAULT true,
  follower_count INTEGER DEFAULT 0,
  fork_source_id UUID REFERENCES investigation_threads(id),
  conclusion_summary TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Items in a thread
CREATE TABLE investigation_thread_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES investigation_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,
  target_id UUID,
  position INTEGER DEFAULT 0,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Users following threads
CREATE TABLE investigation_thread_followers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES investigation_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(thread_id, user_id)
);

-- Crowdsourced OCR fixes
CREATE TABLE ocr_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chunk_id UUID REFERENCES chunks(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  page_number INTEGER,
  original_text TEXT NOT NULL,
  corrected_text TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  reviewed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Document completeness tracking
CREATE TABLE document_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  review_type TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(document_id, user_id, review_type)
);

-- Targeted investigation requests
CREATE TABLE research_bounties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  entity_ids UUID[] DEFAULT '{}',
  target_type TEXT NOT NULL,
  xp_reward INTEGER DEFAULT 0,
  status TEXT DEFAULT 'open',
  claimed_by UUID REFERENCES auth.users(id),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for collaborative research tables
ALTER TABLE annotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON annotations FOR SELECT USING (true);
CREATE POLICY "Auth users can create annotations" ON annotations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own annotations" ON annotations FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own annotations" ON annotations FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE investigation_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public threads are readable" ON investigation_threads FOR SELECT USING (is_public = true OR auth.uid() = user_id);
CREATE POLICY "Auth users can create threads" ON investigation_threads FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own threads" ON investigation_threads FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE investigation_thread_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Items in public threads are readable" ON investigation_thread_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM investigation_threads t WHERE t.id = thread_id AND (t.is_public = true OR t.user_id = auth.uid())));
CREATE POLICY "Auth users can add items to own threads" ON investigation_thread_items FOR INSERT
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM investigation_threads t WHERE t.id = thread_id AND t.user_id = auth.uid()));

ALTER TABLE investigation_thread_followers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can see own follows" ON investigation_thread_followers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Auth users can follow threads" ON investigation_thread_followers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unfollow" ON investigation_thread_followers FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE ocr_corrections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON ocr_corrections FOR SELECT USING (true);
CREATE POLICY "Auth users can submit corrections" ON ocr_corrections FOR INSERT WITH CHECK (auth.uid() = user_id);

ALTER TABLE document_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON document_reviews FOR SELECT USING (true);
CREATE POLICY "Auth users can submit reviews" ON document_reviews FOR INSERT WITH CHECK (auth.uid() = user_id);

ALTER TABLE research_bounties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON research_bounties FOR SELECT USING (true);
CREATE POLICY "Auth users can create bounties" ON research_bounties FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Creators can update own bounties" ON research_bounties FOR UPDATE USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);

-- Indexes for collaborative research
CREATE INDEX idx_annotations_document ON annotations (document_id);
CREATE INDEX idx_annotations_chunk ON annotations (chunk_id);
CREATE INDEX idx_annotations_user ON annotations (user_id);
CREATE INDEX idx_investigation_threads_user ON investigation_threads (user_id);
CREATE INDEX idx_investigation_threads_status ON investigation_threads (status) WHERE is_public = true;
CREATE INDEX idx_thread_items_thread ON investigation_thread_items (thread_id, position);
CREATE INDEX idx_thread_followers_thread ON investigation_thread_followers (thread_id);
CREATE INDEX idx_ocr_corrections_document ON ocr_corrections (document_id);
CREATE INDEX idx_ocr_corrections_status ON ocr_corrections (status);
CREATE INDEX idx_document_reviews_document ON document_reviews (document_id);
CREATE INDEX idx_bounties_status ON research_bounties (status);
```

### Step 20: Create Migration 00017 — Notifications & Alerts

File: `supabase/migrations/00017_notifications_alerts.sql`

```sql
-- 00017_notifications_alerts.sql

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE saved_search_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  saved_search_id UUID NOT NULL REFERENCES saved_searches(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  frequency TEXT DEFAULT 'daily',
  last_notified_at TIMESTAMPTZ,
  new_results_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE fact_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fact_text TEXT NOT NULL,
  confidence FLOAT DEFAULT 0,
  entity_ids UUID[] DEFAULT '{}',
  supporting_chunk_ids UUID[] DEFAULT '{}',
  supporting_document_ids UUID[] DEFAULT '{}',
  verified_by UUID[] DEFAULT '{}',
  verification_count INTEGER DEFAULT 0,
  counter_evidence_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'proposed',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can insert notifications" ON notifications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE saved_search_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own alerts" ON saved_search_alerts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own alerts" ON saved_search_alerts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own alerts" ON saved_search_alerts FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own alerts" ON saved_search_alerts FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE fact_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON fact_registry FOR SELECT USING (true);
CREATE POLICY "Auth users can submit facts" ON fact_registry FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Indexes for notifications
CREATE INDEX idx_notifications_user ON notifications (user_id, is_read, created_at DESC);
CREATE INDEX idx_saved_search_alerts_user ON saved_search_alerts (user_id);
CREATE INDEX idx_fact_registry_status ON fact_registry (status);
CREATE INDEX idx_fact_registry_entities ON fact_registry USING gin (entity_ids);
```

### Step 21: Create Migration 00018 — Content-Type Browse & Audio

File: `supabase/migrations/00018_content_type_audio.sql`

```sql
-- 00018_content_type_audio.sql

CREATE TABLE audio_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  dataset_id UUID REFERENCES datasets(id),
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  duration_seconds INTEGER,
  transcript TEXT,
  transcript_language TEXT DEFAULT 'en',
  file_type TEXT,
  file_size_bytes BIGINT,
  processing_status TEXT DEFAULT 'pending',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE audio_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audio_id UUID NOT NULL REFERENCES audio_files(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  timestamp_start FLOAT,
  timestamp_end FLOAT,
  speaker_label TEXT,
  content_embedding VECTOR(1024),
  content_tsv TSVECTOR,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(audio_id, chunk_index)
);

-- Uses content_tsv_trigger (no contextual_header on audio_chunks)
CREATE TRIGGER audio_chunks_tsv_update
  BEFORE INSERT OR UPDATE OF content ON audio_chunks
  FOR EACH ROW EXECUTE FUNCTION content_tsv_trigger();

CREATE TABLE pinboard_boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT false,
  board_data JSONB DEFAULT '{"pins": [], "connections": []}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE structured_data_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_id UUID REFERENCES chunks(id) ON DELETE CASCADE,
  extraction_type TEXT NOT NULL,
  extracted_data JSONB NOT NULL,
  confidence FLOAT,
  verified_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for content-type tables
ALTER TABLE audio_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON audio_files FOR SELECT USING (true);

ALTER TABLE audio_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON audio_chunks FOR SELECT USING (true);

ALTER TABLE pinboard_boards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public boards are readable" ON pinboard_boards FOR SELECT USING (is_public = true OR auth.uid() = user_id);
CREATE POLICY "Auth users can create boards" ON pinboard_boards FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own boards" ON pinboard_boards FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own boards" ON pinboard_boards FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE structured_data_extractions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON structured_data_extractions FOR SELECT USING (true);

-- Indexes for content-type tables
CREATE INDEX idx_audio_files_dataset ON audio_files (dataset_id);
CREATE INDEX idx_audio_files_status ON audio_files (processing_status);
CREATE INDEX idx_audio_chunks_audio ON audio_chunks (audio_id);
CREATE INDEX idx_audio_chunks_embedding ON audio_chunks USING hnsw (content_embedding vector_cosine_ops);
CREATE INDEX idx_audio_chunks_tsv ON audio_chunks USING gin (content_tsv);
CREATE INDEX idx_pinboard_boards_user ON pinboard_boards (user_id);
CREATE INDEX idx_structured_data_document ON structured_data_extractions (document_id);
CREATE INDEX idx_structured_data_type ON structured_data_extractions (extraction_type);
```

### Step 22: Create `lib/supabase/client.ts` — Browser client

```typescript
// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/supabase'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### Step 23: Create `lib/supabase/server.ts` — Server client (RSC, Route Handlers)

```typescript
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/supabase'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll called from Server Component — can be ignored
            // if middleware is refreshing user sessions
          }
        },
      },
    }
  )
}
```

### Step 24: Create `lib/supabase/admin.ts` — Service role client (bypasses RLS)

```typescript
// lib/supabase/admin.ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
```

### Step 25: Create `middleware.ts` — Auth session refresh

This is required for Supabase Auth to work with Next.js App Router. Without it, the server client cannot properly read/refresh auth cookies.

```typescript
// middleware.ts (project root, next to app/)
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh the auth session — this is the critical call
  await supabase.auth.getUser()

  return supabaseResponse
}

export const config = {
  matcher: [
    // Match all paths except static files and images
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

### Step 26: Create `types/supabase.ts` — Auto-generated types placeholder

```typescript
// types/supabase.ts
// This file is a placeholder. Regenerate from your live schema with:
//   npx supabase gen types typescript --project-id <ref> > types/supabase.ts
// Or run: ./scripts/setup-types.sh

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Placeholder Database type — replace with generated types after running migrations
export interface Database {
  public: {
    Tables: {
      [key: string]: {
        Row: Record<string, unknown>
        Insert: Record<string, unknown>
        Update: Record<string, unknown>
      }
    }
    Views: {
      [key: string]: {
        Row: Record<string, unknown>
      }
    }
    Functions: {
      [key: string]: {
        Args: Record<string, unknown>
        Returns: unknown
      }
    }
    Enums: Record<string, never>
  }
}
```

### Step 27: Create `types/entities.ts`

```typescript
// types/entities.ts

export type EntityType =
  | 'person'
  | 'organization'
  | 'location'
  | 'aircraft'
  | 'vessel'
  | 'property'
  | 'account'

export type MentionType =
  | 'direct'
  | 'indirect'
  | 'implied'
  | 'co_occurrence'

export type RelationshipType =
  | 'traveled_with'
  | 'employed_by'
  | 'associate_of'
  | 'family_member'
  | 'legal_representative'
  | 'financial_connection'
  | 'mentioned_together'
  | 'witness_testimony'
  | 'employer_of'
  | 'guest_of'

export interface Entity {
  id: string
  name: string
  entity_type: EntityType
  aliases: string[]
  description: string | null
  first_seen_date: string | null
  last_seen_date: string | null
  mention_count: number
  document_count: number
  metadata: Record<string, unknown>
  is_verified: boolean
  created_at: string
  updated_at: string
}

export interface EntityMention {
  id: string
  entity_id: string
  chunk_id: string | null
  document_id: string
  video_chunk_id: string | null
  mention_text: string
  context_snippet: string | null
  mention_type: MentionType
  confidence: number
  page_number: number | null
  created_at: string
}

export interface EntityRelationship {
  id: string
  entity_a_id: string
  entity_b_id: string
  relationship_type: RelationshipType
  description: string | null
  evidence_chunk_ids: string[]
  evidence_document_ids: string[]
  date_range: string | null
  strength: number
  is_verified: boolean
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface EntityConnectionNode {
  entity_id: string
  entity_name: string
  entity_type: EntityType
  mention_count: number
  depth: number
  connected_from: string | null
  relationship_type: string | null
  relationship_strength: number | null
}

export interface EntityMentionStats {
  document_id: string
  document_filename: string
  document_classification: string | null
  dataset_name: string | null
  mention_count: number
  mention_types: string[]
  first_mention: string
  last_mention: string
}
```

### Step 28: Create `types/search.ts`

```typescript
// types/search.ts

export type SearchTab = 'all' | 'documents' | 'images' | 'videos' | 'entities' | 'audio'

export type SortOption = 'relevance' | 'date_asc' | 'date_desc' | 'mentions'

export interface SearchFilters {
  dataset_id?: string
  doc_type?: string
  date_from?: string
  date_to?: string
  entity_id?: string
  has_redactions?: boolean
  tab?: SearchTab
}

export interface SearchRequest {
  query: string
  filters?: SearchFilters
  page?: number
  per_page?: number
  sort?: SortOption
}

export interface SearchResult {
  chunk_id: string
  document_id: string
  content: string
  contextual_header: string | null
  page_number: number | null
  section_title: string | null
  document_filename: string
  document_classification: string | null
  dataset_name: string | null
  rrf_score: number
  semantic_rank: number | null
  keyword_rank: number | null
  highlight_ranges?: { start: number; end: number }[]
}

export interface MultimodalResult {
  result_id: string
  source_type: 'document' | 'image' | 'video' | 'audio'
  content: string
  document_id: string | null
  page_number: number | null
  storage_path: string | null
  filename: string | null
  dataset_name: string | null
  rrf_score: number
}

export interface SearchResponse {
  results: SearchResult[]
  total_count: number
  query: string
  filters: SearchFilters
  page: number
  per_page: number
  took_ms: number
}

export interface MultimodalSearchResponse {
  results: MultimodalResult[]
  total_count: number
  query: string
  took_ms: number
}
```

### Step 29: Create `types/chat.ts`

```typescript
// types/chat.ts

export type ChatRole = 'user' | 'assistant' | 'system'

export type ModelTier = 'free' | 'researcher' | 'pro'

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  citations?: Citation[]
  tool_calls?: ToolCall[]
  created_at: string
}

export interface Citation {
  document_id: string
  document_filename: string
  page_number: number | null
  chunk_id: string
  snippet: string
  dataset_name: string | null
}

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
  result?: unknown
}

export interface ChatConversation {
  id: string
  user_id: string | null
  session_id: string
  title: string | null
  messages: ChatMessage[]
  model_tier: ModelTier
  message_count: number
  created_at: string
  updated_at: string
}

export interface ChatStreamEvent {
  type: 'text_delta' | 'citation' | 'tool_call' | 'done' | 'error'
  content?: string
  citation?: Citation
  tool_call?: ToolCall
  error?: string
}

export interface ChatRequest {
  message: string
  conversation_id?: string
  session_id: string
  model_tier?: ModelTier
}
```

### Step 30: Create `types/redaction.ts`

```typescript
// types/redaction.ts

export type RedactionStatus =
  | 'unsolved'
  | 'proposed'
  | 'corroborated'
  | 'confirmed'
  | 'disputed'

export type RedactionType =
  | 'name'
  | 'date'
  | 'location'
  | 'organization'
  | 'amount'
  | 'unknown'

export type EvidenceType =
  | 'public_statement'
  | 'cross_reference'
  | 'context_deduction'
  | 'document_comparison'
  | 'official_release'
  | 'media_report'
  | 'other'

export type ProposalStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'superseded'

export type VoteType = 'upvote' | 'downvote' | 'corroborate'

export interface Redaction {
  id: string
  document_id: string
  chunk_id: string | null
  page_number: number | null
  redaction_type: RedactionType | null
  char_length_estimate: number | null
  surrounding_text: string
  sentence_template: string | null
  co_occurring_entity_ids: string[]
  document_date: string | null
  document_type: string | null
  position_in_page: { x: number; y: number; width: number; height: number } | null
  status: RedactionStatus
  resolved_text: string | null
  resolved_entity_id: string | null
  confidence: number
  resolved_at: string | null
  resolved_method: string | null
  cascade_source_id: string | null
  cascade_depth: number
  cascade_count: number
  potential_cascade_count: number
  created_at: string
  updated_at: string
}

export interface RedactionProposal {
  id: string
  redaction_id: string
  user_id: string
  proposed_text: string
  proposed_entity_id: string | null
  evidence_type: EvidenceType
  evidence_description: string
  evidence_sources: string[]
  supporting_chunk_ids: string[]
  upvotes: number
  downvotes: number
  corroborations: number
  context_match_score: number | null
  length_match: boolean | null
  entity_graph_consistency: number | null
  composite_confidence: number | null
  status: ProposalStatus
  reviewed_at: string | null
  created_at: string
}

export interface ProposalVote {
  id: string
  proposal_id: string
  user_id: string
  vote_type: VoteType
  created_at: string
}

export interface UserProfile {
  id: string
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  proposals_submitted: number
  proposals_confirmed: number
  cascades_triggered: number
  accuracy_rate: number
  reputation_score: number
  expertise_areas: string[]
  tier: string
  xp: number
  level: number
  level_title: string
  current_streak: number
  longest_streak: number
  last_contribution_date: string | null
  total_cascades_triggered: number
  created_at: string
  updated_at: string
}

export interface RedactionStats {
  total_redactions: number
  unsolved: number
  proposed: number
  corroborated: number
  confirmed: number
  disputed: number
  total_cascades: number
  avg_cascade_depth: number
  total_proposals: number
  total_contributors: number
}

export interface CascadeNode {
  redaction_id: string
  parent_id: string | null
  resolved_text: string | null
  resolved_entity_name: string | null
  document_filename: string
  page_number: number | null
  cascade_depth: number
  resolved_at: string | null
}

export interface SolvableRedaction {
  redaction_id: string
  document_id: string
  document_filename: string
  dataset_name: string | null
  page_number: number | null
  redaction_type: RedactionType | null
  char_length_estimate: number | null
  surrounding_text: string
  sentence_template: string | null
  status: RedactionStatus
  potential_cascade_count: number
  proposal_count: number
  top_proposal_confidence: number | null
}
```

### Step 31: Create `types/collaboration.ts`

```typescript
// types/collaboration.ts

export type AnnotationType =
  | 'question'
  | 'observation'
  | 'correction'
  | 'connection'

export type ThreadStatus = 'active' | 'completed' | 'archived'

export type ThreadItemType =
  | 'document'
  | 'entity'
  | 'timeline_event'
  | 'annotation'
  | 'note'
  | 'image'

export type OCRCorrectionStatus = 'pending' | 'approved' | 'rejected'

export type ReviewType =
  | 'ocr_verified'
  | 'entities_confirmed'
  | 'dates_validated'
  | 'redactions_attempted'
  | 'cross_references_checked'

export type BountyTargetType = 'entity' | 'redaction' | 'question' | 'pattern'

export type BountyStatus = 'open' | 'claimed' | 'completed' | 'expired'

export type NotificationType =
  | 'proposal_update'
  | 'annotation_reply'
  | 'search_alert'
  | 'achievement'
  | 'bounty'
  | 'system'

export type AlertFrequency = 'immediate' | 'daily' | 'weekly'

export type FactStatus = 'proposed' | 'verified' | 'disputed' | 'retracted'

export type ExtractionType =
  | 'flight_manifest'
  | 'financial_record'
  | 'phone_record'
  | 'address_book_entry'

export interface Annotation {
  id: string
  user_id: string
  document_id: string
  chunk_id: string | null
  page_number: number | null
  content: string
  annotation_type: AnnotationType
  parent_id: string | null
  upvotes: number
  downvotes: number
  created_at: string
  updated_at: string
  // Joined fields
  user_display_name?: string
  user_avatar_url?: string
  replies?: Annotation[]
}

export interface InvestigationThread {
  id: string
  user_id: string
  title: string
  description: string | null
  status: ThreadStatus
  is_public: boolean
  follower_count: number
  fork_source_id: string | null
  conclusion_summary: string | null
  tags: string[]
  created_at: string
  updated_at: string
  // Joined fields
  user_display_name?: string
  user_avatar_url?: string
  item_count?: number
}

export interface InvestigationThreadItem {
  id: string
  thread_id: string
  user_id: string
  item_type: ThreadItemType
  target_id: string | null
  position: number
  note: string | null
  created_at: string
}

export interface OCRCorrection {
  id: string
  user_id: string
  chunk_id: string | null
  document_id: string
  page_number: number | null
  original_text: string
  corrected_text: string
  status: OCRCorrectionStatus
  reviewed_by: string | null
  created_at: string
}

export interface DocumentReview {
  id: string
  document_id: string
  user_id: string
  review_type: ReviewType
  notes: string | null
  created_at: string
}

export interface ResearchBounty {
  id: string
  created_by: string
  title: string
  description: string
  entity_ids: string[]
  target_type: BountyTargetType
  xp_reward: number
  status: BountyStatus
  claimed_by: string | null
  completed_at: string | null
  expires_at: string | null
  created_at: string
  // Joined fields
  creator_display_name?: string
}

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  message: string | null
  link: string | null
  is_read: boolean
  created_at: string
}

export interface SavedSearchAlert {
  id: string
  user_id: string
  saved_search_id: string
  is_active: boolean
  frequency: AlertFrequency
  last_notified_at: string | null
  new_results_count: number
  created_at: string
}

export interface Fact {
  id: string
  fact_text: string
  confidence: number
  entity_ids: string[]
  supporting_chunk_ids: string[]
  supporting_document_ids: string[]
  verified_by: string[]
  verification_count: number
  counter_evidence_count: number
  status: FactStatus
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface AudioFile {
  id: string
  document_id: string | null
  dataset_id: string | null
  filename: string
  storage_path: string
  duration_seconds: number | null
  transcript: string | null
  transcript_language: string
  file_type: string | null
  file_size_bytes: number | null
  processing_status: string
  metadata: Record<string, unknown>
  created_at: string
}

export interface AudioChunk {
  id: string
  audio_id: string
  chunk_index: number
  content: string
  timestamp_start: number | null
  timestamp_end: number | null
  speaker_label: string | null
  created_at: string
}

export interface PinboardBoard {
  id: string
  user_id: string
  title: string
  description: string | null
  is_public: boolean
  board_data: {
    pins: PinboardPin[]
    connections: PinboardConnection[]
  }
  created_at: string
  updated_at: string
}

export interface PinboardPin {
  id: string
  type: 'document' | 'entity' | 'image' | 'timeline_event' | 'note'
  target_id?: string
  label: string
  note?: string
  x: number
  y: number
}

export interface PinboardConnection {
  id: string
  from_pin_id: string
  to_pin_id: string
  label?: string
}

export interface StructuredDataExtraction {
  id: string
  document_id: string
  chunk_id: string | null
  extraction_type: ExtractionType
  extracted_data: Record<string, unknown>
  confidence: number | null
  verified_by: string | null
  created_at: string
}

// Corpus stats from materialized view
export interface CorpusStats {
  total_documents: number
  processed_documents: number
  total_pages: number | null
  total_chunks: number
  total_images: number
  total_videos: number
  total_entities: number
  total_relationships: number
  total_redactions: number
  solved_redactions: number
  corroborated_redactions: number
  total_proposals: number
  total_contributors: number
}

// Funding types
export interface FundingStatus {
  id: string
  gofundme_url: string | null
  goal_amount: number
  raised_amount: number
  donor_count: number
  last_synced_at: string
  updated_at: string
}

export interface SpendLogEntry {
  id: string
  amount: number
  service: string
  description: string
  pages_processed: number | null
  chunks_created: number | null
  entities_extracted: number | null
  redactions_detected: number | null
  images_processed: number | null
  dataset_id: string | null
  triggered_by: string | null
  created_at: string
}

export interface DonationImpactTier {
  id: string
  amount: number
  label: string
  description: string
  pages_processed: number | null
  entities_extracted: number | null
  analogy: string | null
  sort_order: number
}
```

### Step 32: Create `scripts/setup-types.sh`

```bash
#!/usr/bin/env bash
# scripts/setup-types.sh
# Regenerate Supabase TypeScript types from your live schema.
# Usage: ./scripts/setup-types.sh

set -euo pipefail

# Check if supabase CLI is available
if ! command -v npx &> /dev/null; then
  echo "Error: npx not found. Make sure Node.js is installed."
  exit 1
fi

# Check for linked project
if [ ! -f "supabase/config.toml" ]; then
  echo "Error: supabase/config.toml not found. Run from project root."
  exit 1
fi

echo "Generating Supabase TypeScript types..."

# Extract project ID from config (or use CLI link)
PROJECT_REF=$(grep -o 'id = "[^"]*"' supabase/config.toml | head -1 | cut -d'"' -f2)

if [ -z "$PROJECT_REF" ]; then
  echo "Error: No project ID found in supabase/config.toml."
  echo "Run: npx supabase link --project-ref <your-project-ref>"
  exit 1
fi

npx supabase gen types typescript \
  --project-id "$PROJECT_REF" \
  --schema public \
  > types/supabase.ts

echo "✓ Types written to types/supabase.ts"
echo ""
echo "Note: After regenerating, you may want to restart your TypeScript server:"
echo "  In VS Code: Cmd+Shift+P → 'TypeScript: Restart TS Server'"
```

Make it executable:

```bash
chmod +x scripts/setup-types.sh
```

### Step 33: Verify build

```bash
pnpm build
```

If TypeScript errors appear about the placeholder `Database` type, that's expected — the real types come after running migrations and `setup-types.sh`. The build should still succeed because the placeholder satisfies the generic constraint.

---

## Pushing Migrations to Supabase

After creating all migration files, push them to your Supabase project:

```bash
# Link to your remote project (one time)
npx supabase link --project-ref <your-project-ref>

# Push all migrations
npx supabase db push
```

If `db push` fails on IVFFlat indexes (empty tables), you can temporarily comment out the vector indexes in `00010_indexes.sql` and `00018_content_type_audio.sql`, push, then uncomment and push again after seeding data.

Alternatively, apply migrations via the Supabase SQL editor in the dashboard — paste each file in order.

---

## Gotchas

1. **Trigger function bug in scaffold:** The original scaffold uses `chunks_tsv_trigger()` for both `chunks` and `video_chunks`, but `video_chunks` doesn't have a `contextual_header` column. This causes a runtime error. Fixed here by creating a separate `content_tsv_trigger()` function for tables without `contextual_header`.

2. **IVFFlat indexes on empty tables:** IVFFlat requires data for optimal indexing. On empty tables with pgvector 0.7+, the CREATE INDEX succeeds but won't be optimized. Consider running `REINDEX` after initial data seeding, or switch to HNSW indexes for small datasets.

3. **Materialized views need refresh:** `corpus_stats` and `weekly_leaderboard` are snapshots. They don't auto-update. Phase 6 (batch scripts) and Phase 10 (gamification) handle refreshing these.

4. **RLS and service role:** The Supabase service role key (`SUPABASE_SERVICE_ROLE_KEY`) bypasses all RLS policies automatically. No explicit service role policies are needed — batch scripts and server-side API routes use the admin client.

5. **Auth user references:** Tables referencing `auth.users(id)` (like `user_profiles`, `redaction_proposals`, etc.) require that a user exists in Supabase Auth before inserting. The `user_profiles` table is populated on first login via an auth trigger or API route (handled in Phase 4).

6. **Migration ordering matters:** Migrations must be applied in order (00001 → 00018). Each migration may reference tables or functions from earlier migrations. The Supabase CLI applies them in filename order.

7. **`middleware.ts` location:** Must be in the project root (same level as `app/`), NOT inside `app/`. Next.js only recognizes middleware at the root level.

8. **Types placeholder:** The `types/supabase.ts` file is a placeholder. After pushing migrations, run `./scripts/setup-types.sh` to generate proper types from your live schema. Until then, the generic `Database` interface provides basic type checking.

9. **`@supabase/ssr` vs `@supabase/auth-helpers-nextjs`:** The newer `@supabase/ssr` package replaces the deprecated `@supabase/auth-helpers-nextjs`. Make sure you install `@supabase/ssr`, not the old helpers.

10. **Recursive CTEs in entity graph:** The `get_entity_connection_graph` function uses a recursive CTE without cycle detection. For deeply connected graphs, this is bounded by `max_depth` and `max_nodes` parameters. If the entity graph has cycles, PostgreSQL handles this via `UNION ALL` deduplication with `DISTINCT ON`.

---

## Files to Create

```
supabase/
├── config.toml
└── migrations/
    ├── 00001_extensions.sql
    ├── 00002_core_tables.sql
    ├── 00003_entity_tables.sql
    ├── 00004_redaction_tables.sql
    ├── 00005_timeline_tables.sql
    ├── 00006_user_tables.sql
    ├── 00007_search_functions.sql
    ├── 00008_entity_functions.sql
    ├── 00009_redaction_functions.sql
    ├── 00010_indexes.sql
    ├── 00011_rls_policies.sql
    ├── 00012_stats_views.sql
    ├── 00013_funding_tables.sql
    ├── 00014_contribution_tables.sql
    ├── 00015_gamification_tables.sql
    ├── 00016_collaborative_research_tables.sql
    ├── 00017_notifications_alerts.sql
    └── 00018_content_type_audio.sql
lib/supabase/
├── client.ts
├── server.ts
└── admin.ts
middleware.ts
types/
├── supabase.ts
├── entities.ts
├── search.ts
├── chat.ts
├── redaction.ts
└── collaboration.ts
scripts/
└── setup-types.sh
```

## Acceptance Criteria

1. All 18 migration files contain valid SQL (no syntax errors)
2. SQL can be reviewed for correctness (table references, foreign keys, constraints all valid)
3. All vector dimensions correct: 768d for text, 1408d for visual
4. RRF search functions match the scaffold spec exactly
5. RLS policies correctly separate public read from authenticated write
6. Supabase clients export correctly and TypeScript compiles
7. All TypeScript type files compile without errors
8. Types align with database schema (field names, types, nullability)
9. `middleware.ts` exists at project root and handles auth session refresh
10. `setup-types.sh` script is executable and documented
11. `pnpm build` succeeds (with placeholder Database type)
12. All migrations can be applied in order via `npx supabase db push`

## Notes

- The exact SQL for migrations 00001-00007 and 00010/00012-00015 comes from the scaffold prompt with the trigger bug fixed
- Migrations 00008-00009 contain complete entity and redaction functions matching the table schemas
- Migration 00011 contains complete RLS policies for all tables through migration 00006
- Migrations 00013-00018 include their own RLS policies inline (self-contained)
- IVFFlat indexes require data to exist for optimal `lists` parameter — the values chosen are reasonable defaults
- Materialized views need periodic refresh — handled by cron or application logic in later phases

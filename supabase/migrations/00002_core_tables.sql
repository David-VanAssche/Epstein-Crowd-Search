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

ALTER TABLE data_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON data_sources FOR SELECT USING (true);

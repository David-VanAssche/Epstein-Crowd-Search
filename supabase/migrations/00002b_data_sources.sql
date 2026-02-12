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

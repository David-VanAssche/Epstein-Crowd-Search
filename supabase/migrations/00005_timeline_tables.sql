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

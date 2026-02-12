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

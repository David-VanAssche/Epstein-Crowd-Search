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

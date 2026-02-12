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

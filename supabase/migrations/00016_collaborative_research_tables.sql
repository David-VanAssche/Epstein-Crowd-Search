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

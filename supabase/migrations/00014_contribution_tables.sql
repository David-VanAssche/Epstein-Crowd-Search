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
-- No client-side INSERT policy — activity is logged by service-role only

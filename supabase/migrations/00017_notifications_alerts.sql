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

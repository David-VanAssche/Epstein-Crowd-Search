-- 00011_rls_policies.sql
-- Row Level Security for all tables.
-- Pattern: public read for content tables, auth write for user-generated data, service role bypasses RLS by default.

-- =======================================
-- PUBLIC READ-ONLY TABLES (content)
-- =======================================

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

-- =======================================
-- USER PROFILES (read all, update own)
-- =======================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON user_profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- =======================================
-- REDACTION PROPOSALS (public read, auth insert/update own)
-- =======================================

ALTER TABLE redaction_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON redaction_proposals FOR SELECT USING (true);
CREATE POLICY "Auth users can submit proposals" ON redaction_proposals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own proposals" ON redaction_proposals FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =======================================
-- PROPOSAL VOTES (public read, auth insert own, unique enforced at DB level)
-- =======================================

ALTER TABLE proposal_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON proposal_votes FOR SELECT USING (true);
CREATE POLICY "Auth users can vote" ON proposal_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own votes" ON proposal_votes FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own votes" ON proposal_votes FOR DELETE USING (auth.uid() = user_id);

-- =======================================
-- SAVED SEARCHES (auth own only)
-- =======================================

ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own saved searches" ON saved_searches FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own saved searches" ON saved_searches FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own saved searches" ON saved_searches FOR DELETE USING (auth.uid() = user_id);

-- =======================================
-- BOOKMARKS (auth own only)
-- =======================================

ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own bookmarks" ON bookmarks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own bookmarks" ON bookmarks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own bookmarks" ON bookmarks FOR DELETE USING (auth.uid() = user_id);

-- =======================================
-- CHAT CONVERSATIONS (auth own only, anonymous by session handled in API)
-- =======================================

ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own conversations" ON chat_conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own conversations" ON chat_conversations FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Users can update own conversations" ON chat_conversations FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

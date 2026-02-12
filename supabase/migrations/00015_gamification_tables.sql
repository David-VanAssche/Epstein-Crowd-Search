-- 00015_gamification_tables.sql

-- Add gamification columns to user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS level_title TEXT DEFAULT 'Observer';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS longest_streak INTEGER DEFAULT 0;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS last_contribution_date DATE;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS total_cascades_triggered INTEGER DEFAULT 0;

-- Achievement definitions (seeded at deploy time)
CREATE TABLE achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  category TEXT NOT NULL,
  requirement_type TEXT NOT NULL,
  requirement_value INTEGER,
  xp_reward INTEGER DEFAULT 0,
  rarity TEXT DEFAULT 'common',
  sort_order INTEGER DEFAULT 0
);

-- User achievements (earned badges)
CREATE TABLE user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ DEFAULT now(),
  trigger_contribution_id UUID,
  UNIQUE(user_id, achievement_id)
);

-- XP transaction log (every XP change)
CREATE TABLE xp_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  contribution_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Weekly leaderboard snapshot (materialized for performance)
CREATE MATERIALIZED VIEW weekly_leaderboard AS
SELECT
  up.id AS user_id,
  up.display_name,
  up.avatar_url,
  up.level,
  up.level_title,
  COALESCE(SUM(xt.amount), 0) AS weekly_xp,
  up.xp AS total_xp,
  up.total_cascades_triggered,
  COUNT(DISTINCT ua.achievement_id) AS achievement_count
FROM user_profiles up
LEFT JOIN xp_transactions xt ON xt.user_id = up.id
  AND xt.created_at >= now() - INTERVAL '7 days'
LEFT JOIN user_achievements ua ON ua.user_id = up.id
GROUP BY up.id, up.display_name, up.avatar_url, up.level, up.level_title, up.xp, up.total_cascades_triggered
ORDER BY weekly_xp DESC;

-- RLS for gamification tables
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON achievements FOR SELECT USING (true);

ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON user_achievements FOR SELECT USING (true);
-- No client-side INSERT policy — achievements are granted by service-role only

ALTER TABLE xp_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own XP transactions" ON xp_transactions FOR SELECT USING (auth.uid() = user_id);
-- No client-side INSERT policy — XP transactions are created by service-role only

-- Index for XP transaction queries
CREATE INDEX idx_xp_transactions_user ON xp_transactions (user_id, created_at DESC);
CREATE INDEX idx_user_achievements_user ON user_achievements (user_id);

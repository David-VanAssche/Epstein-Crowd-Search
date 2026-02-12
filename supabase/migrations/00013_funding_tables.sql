-- 00013_funding_tables.sql

CREATE TABLE funding_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gofundme_url TEXT,
  goal_amount NUMERIC NOT NULL DEFAULT 16000,
  raised_amount NUMERIC NOT NULL DEFAULT 0,
  donor_count INTEGER DEFAULT 0,
  last_synced_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default row
INSERT INTO funding_status (gofundme_url, goal_amount, raised_amount, donor_count)
VALUES ('https://www.gofundme.com/f/the-epstein-archive', 16000, 0, 0);

CREATE TABLE processing_spend_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount NUMERIC NOT NULL,
  service TEXT NOT NULL,
  description TEXT NOT NULL,
  pages_processed INTEGER,
  chunks_created INTEGER,
  entities_extracted INTEGER,
  redactions_detected INTEGER,
  images_processed INTEGER,
  dataset_id UUID REFERENCES datasets(id),
  triggered_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE donation_impact_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount NUMERIC NOT NULL,
  label TEXT NOT NULL,
  description TEXT NOT NULL,
  pages_processed INTEGER,
  entities_extracted INTEGER,
  analogy TEXT,
  sort_order INTEGER DEFAULT 0
);

-- Seed the 10 donation impact tiers
INSERT INTO donation_impact_tiers (amount, label, description, pages_processed, entities_extracted, analogy, sort_order) VALUES
  (1, '$1', 'A small stack of FBI interview summaries', 475, 10, 'About the size of a paperback novel', 1),
  (5, '$5', 'A full deposition transcript', 2400, 50, 'One person''s entire testimony under oath', 2),
  (10, '$10', 'A batch of flight logs spanning several months', 4750, 100, 'Every passenger who flew on the Lolita Express for a quarter', 3),
  (25, '$25', 'An entire FBI case subfolder', 12000, 250, 'More pages than the entire 9/11 Commission Report', 4),
  (50, '$50', 'A major court proceeding with all exhibits', 24000, 500, 'The complete legal record of one Epstein case', 5),
  (100, '$100', 'Half of a small DOJ dataset', 48000, 1000, 'Enough to surface ~500 entity connections the public has never seen', 6),
  (250, '$250', 'An entire mid-sized dataset', 119000, 2500, 'Processing a whole filing cabinet of evidence', 7),
  (500, '$500', 'A large dataset with full entity extraction', 238000, 5000, 'More pages than every Harry Potter book combined — times ten', 8),
  (1500, '$1,500', '20% of the entire corpus', 714000, 15000, 'One-fifth of everything the DOJ released', 9),
  (5000, '$5,000', 'Two-thirds of the entire corpus', 2380000, 50000, 'Most of the truth, searchable in weeks', 10);

-- RLS for funding tables
ALTER TABLE funding_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON funding_status FOR SELECT USING (true);

ALTER TABLE processing_spend_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON processing_spend_log FOR SELECT USING (true);

ALTER TABLE donation_impact_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON donation_impact_tiers FOR SELECT USING (true);

-- 00026_crowdfunded_processing.sql
-- Crowdfunded processing system: campaigns, contributions, spend tracking

-- ============================================================
-- processing_campaigns — one row per fundable feature
-- ============================================================
CREATE TABLE processing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT 'Folder',
  pipeline_stages TEXT[] NOT NULL DEFAULT '{}',
  total_units INTEGER NOT NULL DEFAULT 0,
  total_units_processed INTEGER NOT NULL DEFAULT 0,
  results_count INTEGER NOT NULL DEFAULT 0,
  cost_per_unit NUMERIC NOT NULL DEFAULT 0,
  funded_amount NUMERIC NOT NULL DEFAULT 0,
  spent_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'funded', 'processing', 'complete', 'paused')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- contributions — one row per Stripe payment
-- ============================================================
CREATE TABLE contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES processing_campaigns(id),
  stripe_checkout_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  stripe_customer_email TEXT,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  donor_display_name TEXT,
  is_anonymous BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Add campaign_id FK to existing processing_spend_log
-- ============================================================
ALTER TABLE processing_spend_log
  ADD COLUMN campaign_id UUID REFERENCES processing_campaigns(id);

-- ============================================================
-- Database Functions
-- ============================================================

-- 1. recompute_funding_status()
-- Aggregates paid contributions into the singleton funding_status row
CREATE OR REPLACE FUNCTION recompute_funding_status()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_raised NUMERIC;
  v_donors INTEGER;
BEGIN
  SELECT
    COALESCE(SUM(amount_cents), 0) / 100.0,
    COUNT(DISTINCT stripe_customer_email)
  INTO v_raised, v_donors
  FROM contributions
  WHERE status = 'paid';

  UPDATE funding_status
  SET
    raised_amount = v_raised,
    donor_count = v_donors,
    updated_at = now();
END;
$$;

-- 2. allocate_contribution(p_contribution_id)
-- Called by webhook after marking a contribution as paid
CREATE OR REPLACE FUNCTION allocate_contribution(p_contribution_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_campaign_id UUID;
  v_amount_cents INTEGER;
BEGIN
  SELECT campaign_id, amount_cents
  INTO v_campaign_id, v_amount_cents
  FROM contributions
  WHERE id = p_contribution_id AND status = 'paid';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contribution % not found or not paid', p_contribution_id;
  END IF;

  -- Increment campaign funded_amount if contribution is tied to a campaign
  IF v_campaign_id IS NOT NULL THEN
    UPDATE processing_campaigns
    SET
      funded_amount = funded_amount + (v_amount_cents / 100.0),
      updated_at = now()
    WHERE id = v_campaign_id;
  END IF;

  -- Recompute global funding status
  PERFORM recompute_funding_status();
END;
$$;

-- 3. log_processing_spend(...)
-- Called by batch runner to atomically log spend and update campaign progress
CREATE OR REPLACE FUNCTION log_processing_spend(
  p_campaign_slug TEXT,
  p_amount NUMERIC,
  p_service TEXT,
  p_description TEXT,
  p_pages_processed INTEGER DEFAULT 0,
  p_entities_extracted INTEGER DEFAULT 0,
  p_redactions_detected INTEGER DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_campaign_id UUID;
  v_log_id UUID;
BEGIN
  -- Look up campaign (NULL slug is fine — general spending)
  IF p_campaign_slug IS NOT NULL THEN
    SELECT id INTO v_campaign_id
    FROM processing_campaigns
    WHERE slug = p_campaign_slug;
  END IF;

  -- Insert spend log entry
  INSERT INTO processing_spend_log (
    amount, service, description,
    pages_processed, entities_extracted, redactions_detected,
    campaign_id
  ) VALUES (
    p_amount, p_service, p_description,
    p_pages_processed, p_entities_extracted, p_redactions_detected,
    v_campaign_id
  ) RETURNING id INTO v_log_id;

  -- Update campaign counters
  IF v_campaign_id IS NOT NULL THEN
    UPDATE processing_campaigns
    SET
      spent_amount = spent_amount + p_amount,
      total_units_processed = total_units_processed + p_pages_processed,
      updated_at = now()
    WHERE id = v_campaign_id;
  END IF;

  RETURN v_log_id;
END;
$$;

-- ============================================================
-- Seed 16 campaigns
-- ============================================================
INSERT INTO processing_campaigns (slug, title, description, icon, pipeline_stages, total_units, cost_per_unit) VALUES
  ('general', 'General Processing Fund', 'Support all document processing across every pipeline stage.', 'Layers', ARRAY['ocr','classify','chunk','embed','entity_extract','relationship_map','redaction_detect','timeline_extract','summarize','criminal_indicators','email_extract','financial_extract','co_flight_links','network_metrics'], 3500000, 0.0064),
  ('entities', 'Entity Extraction', 'Extract people, organizations, locations, and other entities from every document.', 'Users', ARRAY['entity_extract'], 3500000, 0.001),
  ('graph', 'Relationship Mapping', 'Map entity-to-entity relationships and compute network metrics.', 'Share2', ARRAY['relationship_map','network_metrics'], 3500000, 0.0008),
  ('timeline', 'Timeline Extraction', 'Extract dated events to build a chronological timeline of activity.', 'Calendar', ARRAY['timeline_extract'], 3500000, 0.0005),
  ('redactions', 'Redaction Detection', 'Detect and catalog redacted regions with surrounding context for solving.', 'EyeOff', ARRAY['redaction_detect'], 3500000, 0.0005),
  ('flights', 'Flight Log Processing', 'Process flight manifests to extract passenger lists, routes, and dates.', 'Plane', ARRAY['entity_extract','co_flight_links'], 85000, 0.001),
  ('emails', 'Email Extraction', 'Extract structured email data including senders, recipients, and threads.', 'Mail', ARRAY['email_extract'], 340000, 0.0006),
  ('finances', 'Financial Extraction', 'Extract financial transactions, wire transfers, and suspicious patterns.', 'DollarSign', ARRAY['financial_extract'], 520000, 0.0006),
  ('contradictions', 'Contradiction Detection', 'Find conflicting claims across documents to identify inconsistencies.', 'AlertTriangle', ARRAY['entity_extract','criminal_indicators'], 3500000, 0.0018),
  ('map', 'Geographic Mapping', 'Map locations mentioned in documents to geographic coordinates.', 'MapPin', ARRAY['entity_extract'], 3500000, 0.001),
  ('photos', 'Photo Analysis', 'Analyze and embed images from the document corpus.', 'Camera', ARRAY['visual_embed'], 180000, 0.0003),
  ('audio', 'Audio Transcription', 'Transcribe audio recordings into searchable text.', 'Headphones', ARRAY['ocr'], 95000, 0.0015),
  ('entity-connections', 'Entity Connection Analysis', 'Analyze entity connections through relationship mapping and network metrics.', 'GitBranch', ARRAY['relationship_map','co_flight_links','network_metrics'], 3500000, 0.0008),
  ('entity-timeline', 'Entity Timeline Generation', 'Generate per-entity chronological timelines from extracted events.', 'Clock', ARRAY['timeline_extract'], 3500000, 0.0005),
  ('entity-mentions', 'Entity Mention Indexing', 'Index every entity mention across the document corpus.', 'FileText', ARRAY['entity_extract'], 3500000, 0.001),
  ('discoveries', 'Discovery Feed Processing', 'Process documents for criminal indicators and entity extraction to surface discoveries.', 'Lightbulb', ARRAY['criminal_indicators','entity_extract'], 3500000, 0.0018);

-- ============================================================
-- RLS policies
-- ============================================================
ALTER TABLE processing_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON processing_campaigns FOR SELECT USING (true);

ALTER TABLE contributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON contributions FOR SELECT USING (true);

-- Indexes
CREATE INDEX idx_contributions_campaign ON contributions(campaign_id);
CREATE INDEX idx_contributions_status ON contributions(status);
CREATE INDEX idx_contributions_session ON contributions(stripe_checkout_session_id);
CREATE INDEX idx_spend_log_campaign ON processing_spend_log(campaign_id);
CREATE INDEX idx_campaigns_slug ON processing_campaigns(slug);

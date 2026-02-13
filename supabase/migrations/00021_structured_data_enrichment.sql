-- Migration 00021: Structured Data Enrichment
-- Phase 11: Person categories, Wikidata enrichment, ghost flights, emails, financial transactions,
-- property ownership, contradictions, thread convergences

-- ============================================================
-- Section 1: Entity enrichment columns
-- ============================================================

-- Person sub-categories for entity classification
ALTER TABLE entities ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE entities ADD CONSTRAINT entities_category_check CHECK (
  category IS NULL OR category IN (
    'associate', 'business_leader', 'celebrity', 'diplomat',
    'educator', 'intelligence', 'legal', 'media', 'medical',
    'military', 'politician', 'royalty', 'staff', 'victim', 'other'
  )
);

-- Wikidata enrichment fields
ALTER TABLE entities ADD COLUMN IF NOT EXISTS wikidata_id TEXT;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS death_date DATE;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS nationality TEXT[] DEFAULT '{}';
ALTER TABLE entities ADD COLUMN IF NOT EXISTS occupation TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_entities_category ON entities (category) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_entities_wikidata_id ON entities (wikidata_id) WHERE wikidata_id IS NOT NULL;

-- ============================================================
-- Section 2: Flight enrichment columns
-- ============================================================

-- Ghost flight detection: manifest status indicates completeness of passenger data
ALTER TABLE structured_data_extractions ADD COLUMN IF NOT EXISTS manifest_status TEXT DEFAULT 'full';
ALTER TABLE structured_data_extractions ADD CONSTRAINT sde_manifest_status_check CHECK (
  manifest_status IN ('full', 'partial', 'missing')
);

-- Data source type for provenance tracking
ALTER TABLE structured_data_extractions ADD COLUMN IF NOT EXISTS data_source_type TEXT;
ALTER TABLE structured_data_extractions ADD CONSTRAINT sde_data_source_type_check CHECK (
  data_source_type IS NULL OR data_source_type IN (
    'faa_record', 'flight_log', 'deposition', 'media_report', 'court_exhibit', 'other'
  )
);

-- Multi-leg flight tracking
ALTER TABLE structured_data_extractions ADD COLUMN IF NOT EXISTS leg_number INT DEFAULT 1;
ALTER TABLE structured_data_extractions ADD COLUMN IF NOT EXISTS trip_group_id TEXT;

CREATE INDEX IF NOT EXISTS idx_sde_trip_group ON structured_data_extractions (trip_group_id) WHERE trip_group_id IS NOT NULL;

-- ============================================================
-- Section 3: Emails table
-- ============================================================

CREATE TABLE IF NOT EXISTS emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_id UUID REFERENCES chunks(id) ON DELETE SET NULL,
  extraction_id UUID REFERENCES structured_data_extractions(id) ON DELETE SET NULL,

  -- Header fields
  message_id TEXT, -- RFC 2822 Message-ID (preserved as TEXT for cross-dataset matching)
  thread_id TEXT,  -- Thread grouping identifier
  in_reply_to TEXT,
  subject TEXT,
  sent_date TIMESTAMPTZ,

  -- Participants (raw text + resolved entity IDs)
  from_raw TEXT,
  from_entity_id UUID REFERENCES entities(id) ON DELETE SET NULL,
  to_raw TEXT[],
  to_entity_ids UUID[] DEFAULT '{}',
  cc_raw TEXT[],
  cc_entity_ids UUID[] DEFAULT '{}',
  bcc_raw TEXT[],
  bcc_entity_ids UUID[] DEFAULT '{}',

  -- Content
  body TEXT,
  body_tsv TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', COALESCE(subject, '') || ' ' || COALESCE(body, ''))) STORED,
  has_attachments BOOLEAN DEFAULT FALSE,
  attachment_filenames TEXT[] DEFAULT '{}',

  -- Metadata
  confidence REAL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_emails_document_id ON emails (document_id);
CREATE INDEX IF NOT EXISTS idx_emails_thread_id ON emails (thread_id) WHERE thread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_emails_from_entity ON emails (from_entity_id) WHERE from_entity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_emails_sent_date ON emails (sent_date) WHERE sent_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_emails_body_tsv ON emails USING GIN (body_tsv);
CREATE INDEX IF NOT EXISTS idx_emails_to_entity_ids ON emails USING GIN (to_entity_ids);

-- ============================================================
-- Section 4: Financial transactions table
-- ============================================================

CREATE TABLE IF NOT EXISTS financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_id UUID REFERENCES chunks(id) ON DELETE SET NULL,
  extraction_id UUID REFERENCES structured_data_extractions(id) ON DELETE SET NULL,

  -- Parties
  from_entity_id UUID REFERENCES entities(id) ON DELETE SET NULL,
  from_raw TEXT,
  to_entity_id UUID REFERENCES entities(id) ON DELETE SET NULL,
  to_raw TEXT,

  -- Transaction details
  amount NUMERIC(15, 2),
  currency TEXT DEFAULT 'USD',
  transaction_date DATE,
  transaction_type TEXT,
  description TEXT,

  -- Analysis flags
  is_suspicious BOOLEAN DEFAULT FALSE,
  suspicious_reasons TEXT[] DEFAULT '{}',
  shell_company_involved BOOLEAN DEFAULT FALSE,

  -- Metadata
  confidence REAL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT ft_transaction_type_check CHECK (
    transaction_type IS NULL OR transaction_type IN (
      'wire_transfer', 'check', 'cash', 'property_purchase', 'donation',
      'legal_fee', 'salary', 'investment', 'loan', 'gift', 'other'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_ft_document_id ON financial_transactions (document_id);
CREATE INDEX IF NOT EXISTS idx_ft_from_entity ON financial_transactions (from_entity_id) WHERE from_entity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ft_to_entity ON financial_transactions (to_entity_id) WHERE to_entity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ft_transaction_date ON financial_transactions (transaction_date) WHERE transaction_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ft_is_suspicious ON financial_transactions (is_suspicious) WHERE is_suspicious = TRUE;

-- ============================================================
-- Section 5: Property ownership table
-- ============================================================

CREATE TABLE IF NOT EXISTS property_ownership (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  owner_entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,

  -- Ownership period
  from_date DATE,
  to_date DATE,

  -- Acquisition details
  acquisition_type TEXT,
  acquisition_amount NUMERIC(15, 2),
  shell_company BOOLEAN DEFAULT FALSE,
  shell_company_name TEXT,

  -- Evidence
  document_ids UUID[] DEFAULT '{}',
  notes TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT po_acquisition_type_check CHECK (
    acquisition_type IS NULL OR acquisition_type IN (
      'purchase', 'gift', 'inheritance', 'trust_transfer', 'corporate_transfer', 'unknown'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_po_property ON property_ownership (property_entity_id);
CREATE INDEX IF NOT EXISTS idx_po_owner ON property_ownership (owner_entity_id);

-- ============================================================
-- Section 6: Contradictions table
-- ============================================================

CREATE TABLE IF NOT EXISTS contradictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- The two contradictory claims
  claim_a TEXT NOT NULL,
  claim_a_chunk_id UUID REFERENCES chunks(id) ON DELETE SET NULL,
  claim_a_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  claim_a_page_number INT,

  claim_b TEXT NOT NULL,
  claim_b_chunk_id UUID REFERENCES chunks(id) ON DELETE SET NULL,
  claim_b_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  claim_b_page_number INT,

  -- Analysis
  severity TEXT DEFAULT 'medium',
  description TEXT,
  entity_ids UUID[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',

  -- Verification
  verify_count INT DEFAULT 0,
  dispute_count INT DEFAULT 0,
  is_verified BOOLEAN DEFAULT FALSE, -- auto-set at 3+ verify votes

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT contradictions_severity_check CHECK (
    severity IN ('low', 'medium', 'high', 'critical')
  )
);

CREATE INDEX IF NOT EXISTS idx_contradictions_entity_ids ON contradictions USING GIN (entity_ids);
CREATE INDEX IF NOT EXISTS idx_contradictions_severity ON contradictions (severity);
CREATE INDEX IF NOT EXISTS idx_contradictions_is_verified ON contradictions (is_verified);

-- ============================================================
-- Section 7: Thread convergences table
-- ============================================================

CREATE TABLE IF NOT EXISTS thread_convergences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_a_id UUID NOT NULL REFERENCES investigation_threads(id) ON DELETE CASCADE,
  thread_b_id UUID NOT NULL REFERENCES investigation_threads(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  overlap_type TEXT NOT NULL,
  description TEXT,
  shared_entity_ids UUID[] DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT now(),

  -- Ensure thread_a_id < thread_b_id for deduplication (enforced by trigger)
  CONSTRAINT tc_no_self_convergence CHECK (thread_a_id != thread_b_id),
  CONSTRAINT tc_pair_unique UNIQUE (thread_a_id, thread_b_id),
  CONSTRAINT tc_overlap_type_check CHECK (
    overlap_type IN ('shared_entity', 'shared_document', 'shared_timeline', 'thematic', 'contradictory')
  )
);

CREATE INDEX IF NOT EXISTS idx_tc_thread_a ON thread_convergences (thread_a_id);
CREATE INDEX IF NOT EXISTS idx_tc_thread_b ON thread_convergences (thread_b_id);

-- Auto-sort trigger: ensure thread_a_id < thread_b_id
CREATE OR REPLACE FUNCTION sort_thread_convergence_pair()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.thread_a_id > NEW.thread_b_id THEN
    -- Swap the IDs so the smaller UUID is always thread_a_id
    DECLARE
      tmp UUID;
    BEGIN
      tmp := NEW.thread_a_id;
      NEW.thread_a_id := NEW.thread_b_id;
      NEW.thread_b_id := tmp;
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sort_thread_convergence ON thread_convergences;
CREATE TRIGGER trg_sort_thread_convergence
  BEFORE INSERT OR UPDATE ON thread_convergences
  FOR EACH ROW
  EXECUTE FUNCTION sort_thread_convergence_pair();

-- ============================================================
-- Section 8: Update extraction_type values
-- ============================================================

-- Add 'email' and 'financial_transaction' to extraction_type check
-- First drop the existing check constraint if it exists
DO $$
BEGIN
  ALTER TABLE structured_data_extractions DROP CONSTRAINT IF EXISTS structured_data_extractions_extraction_type_check;
  ALTER TABLE structured_data_extractions ADD CONSTRAINT structured_data_extractions_extraction_type_check CHECK (
    extraction_type IN (
      'flight_manifest', 'financial_record', 'phone_record', 'address_book_entry',
      'email', 'financial_transaction'
    )
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not update extraction_type check constraint: %', SQLERRM;
END;
$$;

-- ============================================================
-- Section 9: Helper functions
-- ============================================================

-- Auto-verify contradictions when verify_count reaches threshold
CREATE OR REPLACE FUNCTION auto_verify_contradiction()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.verify_count >= 3 AND NOT NEW.is_verified THEN
    NEW.is_verified := TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_verify_contradiction ON contradictions;
CREATE TRIGGER trg_auto_verify_contradiction
  BEFORE UPDATE ON contradictions
  FOR EACH ROW
  WHEN (NEW.verify_count IS DISTINCT FROM OLD.verify_count)
  EXECUTE FUNCTION auto_verify_contradiction();

-- ============================================================
-- Section 10: RLS Policies
-- ============================================================

-- Emails: public read, service role write
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY emails_public_read ON emails FOR SELECT USING (true);
CREATE POLICY emails_service_write ON emails FOR ALL USING (
  (SELECT auth.role()) = 'service_role'
);

-- Financial transactions: public read, service role write
ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY ft_public_read ON financial_transactions FOR SELECT USING (true);
CREATE POLICY ft_service_write ON financial_transactions FOR ALL USING (
  (SELECT auth.role()) = 'service_role'
);

-- Property ownership: public read, service role write
ALTER TABLE property_ownership ENABLE ROW LEVEL SECURITY;
CREATE POLICY po_public_read ON property_ownership FOR SELECT USING (true);
CREATE POLICY po_service_write ON property_ownership FOR ALL USING (
  (SELECT auth.role()) = 'service_role'
);

-- Contradictions: public read, authenticated create, service role manage
ALTER TABLE contradictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY contradictions_public_read ON contradictions FOR SELECT USING (true);
CREATE POLICY contradictions_auth_insert ON contradictions FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
);
CREATE POLICY contradictions_service_write ON contradictions FOR ALL USING (
  (SELECT auth.role()) = 'service_role'
);

-- Thread convergences: public read, authenticated create
ALTER TABLE thread_convergences ENABLE ROW LEVEL SECURITY;
CREATE POLICY tc_public_read ON thread_convergences FOR SELECT USING (true);
CREATE POLICY tc_auth_insert ON thread_convergences FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
);
CREATE POLICY tc_service_write ON thread_convergences FOR ALL USING (
  (SELECT auth.role()) = 'service_role'
);

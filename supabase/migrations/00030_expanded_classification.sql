-- 00030_expanded_classification.sql
-- Expand document classification from 16 single-label types to ~30 types
-- with multi-label support (primary class + tags).
--
-- Design rationale:
--   - classification (TEXT) stays as primary class for fast routing/indexing
--   - classification_tags (TEXT[]) stores secondary/auxiliary types
--   - classification_raw (JSONB) stores full classifier output for audit
--   - Content heuristic flags enable chunk-level routing fallbacks

-- 1. New columns on documents
ALTER TABLE documents ADD COLUMN IF NOT EXISTS classification_tags TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE documents ADD COLUMN IF NOT EXISTS classification_raw JSONB;

-- Ensure NULL values are backfilled to empty array
UPDATE documents SET classification_tags = ARRAY[]::TEXT[] WHERE classification_tags IS NULL;

-- GIN index for tag-based routing queries (use @> operator, e.g., classification_tags @> ARRAY['financial_record'])
CREATE INDEX IF NOT EXISTS idx_documents_classification_tags
  ON documents USING gin(classification_tags);

-- 2. Update get_document_probative_weight to include expanded types.
--    New types slot into existing tiers. Backward compatible: all old values still work.
DROP FUNCTION IF EXISTS get_document_probative_weight(TEXT);
CREATE OR REPLACE FUNCTION get_document_probative_weight(p_classification TEXT)
RETURNS REAL
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE lower(coalesce(p_classification, 'other'))
    -- Tier 1: Sworn testimony (1.0)
    WHEN 'deposition' THEN 1.0
    WHEN 'grand_jury_testimony' THEN 1.0
    WHEN 'witness_statement' THEN 1.0
    WHEN 'plea_agreement' THEN 1.0
    -- Tier 2: Official / law enforcement (0.7)
    WHEN 'court_filing' THEN 0.7
    WHEN 'indictment' THEN 0.7
    WHEN 'subpoena' THEN 0.7
    WHEN 'search_warrant' THEN 0.7
    WHEN 'police_report' THEN 0.7
    WHEN 'fbi_report' THEN 0.7
    WHEN 'government_report' THEN 0.7
    -- Tier 3: Records (0.4)
    WHEN 'flight_log' THEN 0.4
    WHEN 'financial_record' THEN 0.4
    WHEN 'tax_filing' THEN 0.4
    WHEN 'trust_document' THEN 0.4
    WHEN 'phone_record' THEN 0.4
    WHEN 'medical_record' THEN 0.4
    WHEN 'corporate_filing' THEN 0.4
    WHEN 'property_record' THEN 0.4
    -- Tier 4: Correspondence (0.2)
    WHEN 'correspondence' THEN 0.2  -- legacy, kept for backward compat
    WHEN 'email' THEN 0.2
    WHEN 'letter' THEN 0.2
    WHEN 'memo' THEN 0.2
    WHEN 'fax' THEN 0.2
    -- Tier 5: Peripheral (0.1)
    WHEN 'address_book' THEN 0.1
    WHEN 'photograph' THEN 0.1
    WHEN 'news_clipping' THEN 0.1
    WHEN 'calendar_schedule' THEN 0.1
    WHEN 'receipt_invoice' THEN 0.1
    ELSE 0.1
  END::REAL;
$$;

-- 3. Legacy mapping function: maps new expanded types back to original 16
--    for any downstream code that hasn't been updated yet.
CREATE OR REPLACE FUNCTION map_classification_to_legacy(p_classification TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE lower(coalesce(p_classification, 'other'))
    -- Direct mappings (unchanged)
    WHEN 'deposition' THEN 'deposition'
    WHEN 'flight_log' THEN 'flight_log'
    WHEN 'financial_record' THEN 'financial_record'
    WHEN 'police_report' THEN 'police_report'
    WHEN 'court_filing' THEN 'court_filing'
    WHEN 'correspondence' THEN 'correspondence'
    WHEN 'phone_record' THEN 'phone_record'
    WHEN 'address_book' THEN 'address_book'
    WHEN 'fbi_report' THEN 'fbi_report'
    WHEN 'grand_jury_testimony' THEN 'grand_jury_testimony'
    WHEN 'witness_statement' THEN 'witness_statement'
    WHEN 'property_record' THEN 'property_record'
    WHEN 'medical_record' THEN 'medical_record'
    WHEN 'photograph' THEN 'photograph'
    WHEN 'news_clipping' THEN 'news_clipping'
    -- New types → legacy parent
    WHEN 'plea_agreement' THEN 'court_filing'
    WHEN 'indictment' THEN 'court_filing'
    WHEN 'subpoena' THEN 'court_filing'
    WHEN 'search_warrant' THEN 'court_filing'
    WHEN 'government_report' THEN 'fbi_report'
    WHEN 'tax_filing' THEN 'financial_record'
    WHEN 'trust_document' THEN 'financial_record'
    WHEN 'corporate_filing' THEN 'financial_record'
    WHEN 'email' THEN 'correspondence'
    WHEN 'letter' THEN 'correspondence'
    WHEN 'memo' THEN 'correspondence'
    WHEN 'fax' THEN 'correspondence'
    WHEN 'calendar_schedule' THEN 'other'
    WHEN 'receipt_invoice' THEN 'financial_record'
    ELSE 'other'
  END;
$$;

-- 4. Content heuristic flags on chunks for routing fallback.
--    These are cheap regex-based flags set during chunking, not LLM-dependent.
--    Two-step add: column without default first (instant), then set default (metadata-only in PG 11+).
ALTER TABLE chunks ADD COLUMN IF NOT EXISTS has_email_headers BOOLEAN;
ALTER TABLE chunks ADD COLUMN IF NOT EXISTS has_financial_amounts BOOLEAN;
ALTER TABLE chunks ADD COLUMN IF NOT EXISTS has_redaction_markers BOOLEAN;
ALTER TABLE chunks ADD COLUMN IF NOT EXISTS has_date_references BOOLEAN;

ALTER TABLE chunks ALTER COLUMN has_email_headers SET DEFAULT false;
ALTER TABLE chunks ALTER COLUMN has_financial_amounts SET DEFAULT false;
ALTER TABLE chunks ALTER COLUMN has_redaction_markers SET DEFAULT false;
ALTER TABLE chunks ALTER COLUMN has_date_references SET DEFAULT false;

COMMENT ON COLUMN chunks.has_email_headers IS 'True if chunk contains From:/To:/Subject: at line start — triggers email extraction regardless of doc classification';
COMMENT ON COLUMN chunks.has_financial_amounts IS 'True if chunk contains dollar amounts ($X,XXX) — triggers financial extraction regardless of doc classification';
COMMENT ON COLUMN chunks.has_redaction_markers IS 'True if chunk contains [REDACTED], [SEALED], XXXXX, or block redaction markers';
COMMENT ON COLUMN chunks.has_date_references IS 'True if chunk contains date patterns (heuristic, may match invalid dates) — triggers timeline extraction';

-- 5. Server-side aggregation function for chunk heuristic flags.
--    Avoids fetching all chunk rows to the orchestrator just for 4 boolean flags.
CREATE OR REPLACE FUNCTION get_document_heuristics(p_document_id UUID)
RETURNS TABLE(
  has_email_headers BOOLEAN,
  has_financial_amounts BOOLEAN,
  has_redaction_markers BOOLEAN,
  has_date_references BOOLEAN
)
LANGUAGE sql STABLE
AS $$
  SELECT
    coalesce(bool_or(has_email_headers), false) AS has_email_headers,
    coalesce(bool_or(has_financial_amounts), false) AS has_financial_amounts,
    coalesce(bool_or(has_redaction_markers), false) AS has_redaction_markers,
    coalesce(bool_or(has_date_references), false) AS has_date_references
  FROM chunks
  WHERE document_id = p_document_id;
$$;

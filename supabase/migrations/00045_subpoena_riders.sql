-- Create subpoena_riders table for structured extraction from Grand Jury subpoenas
-- Used by the subpoena-extractor pipeline stage.

CREATE TABLE IF NOT EXISTS subpoena_riders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  target_entity TEXT NOT NULL,
  target_category TEXT NOT NULL CHECK (target_category IN (
    'financial_institution', 'tech_company', 'individual', 'government', 'other'
  )),
  subpoena_date TEXT,
  cited_statutes TEXT[] DEFAULT '{}',
  requested_doc_types TEXT[] DEFAULT '{}',
  page_start INTEGER,
  page_end INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subpoena_riders_document
  ON subpoena_riders (document_id);

CREATE INDEX IF NOT EXISTS idx_subpoena_riders_target
  ON subpoena_riders (target_entity);

CREATE INDEX IF NOT EXISTS idx_subpoena_riders_category
  ON subpoena_riders (target_category);

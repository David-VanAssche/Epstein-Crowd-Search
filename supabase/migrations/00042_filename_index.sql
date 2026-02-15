-- Migration 00042: Add index on documents.filename for enrichment PATCH queries.
-- Without this, UPDATE ... WHERE filename = 'EFTA00037849.pdf' does a sequential
-- scan across 1.38M rows and times out on Supabase's statement_timeout.

CREATE INDEX IF NOT EXISTS idx_documents_filename
ON documents (filename);

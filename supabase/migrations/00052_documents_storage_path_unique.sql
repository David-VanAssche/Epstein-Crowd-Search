-- 00052: Add unique partial index on documents.storage_path
--
-- Pre-check (run manually first):
-- SELECT storage_path, count(*) FROM documents WHERE storage_path IS NOT NULL GROUP BY 1 HAVING count(*) > 1;
-- If duplicates found, deduplicate before applying this migration.

CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_storage_path_unique
  ON documents (storage_path) WHERE storage_path IS NOT NULL;

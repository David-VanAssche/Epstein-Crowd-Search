-- 00010_indexes.sql

-- HNSW indexes (better recall than IVFFlat, works on empty tables)
-- All embeddings are 1024d Nova vectors in a unified space
CREATE INDEX idx_chunks_embedding ON chunks USING hnsw (content_embedding vector_cosine_ops);
CREATE INDEX idx_images_visual_emb ON images USING hnsw (visual_embedding vector_cosine_ops);
CREATE INDEX idx_entities_name_emb ON entities USING hnsw (name_embedding vector_cosine_ops);
CREATE INDEX idx_redactions_embedding ON redactions USING hnsw (context_embedding vector_cosine_ops);
CREATE INDEX idx_timeline_embedding ON timeline_events USING hnsw (content_embedding vector_cosine_ops);
CREATE INDEX idx_video_chunks_embedding ON video_chunks USING hnsw (content_embedding vector_cosine_ops);

-- GIN indexes (full-text search + trigram)
CREATE INDEX idx_chunks_tsv ON chunks USING gin (content_tsv);
CREATE INDEX idx_entities_name_trgm ON entities USING gin (name gin_trgm_ops);
CREATE INDEX idx_video_chunks_tsv ON video_chunks USING gin (content_tsv);

-- B-tree indexes (lookups, sorting, joins)
CREATE INDEX idx_chunks_document_id ON chunks (document_id);
CREATE INDEX idx_entity_mentions_entity ON entity_mentions (entity_id);
CREATE INDEX idx_entity_mentions_document ON entity_mentions (document_id);
-- Prevent duplicate mentions from concurrent entity extraction (race condition safeguard)
CREATE UNIQUE INDEX idx_entity_mentions_unique ON entity_mentions (document_id, entity_id, chunk_id) WHERE chunk_id IS NOT NULL;
CREATE INDEX idx_entity_relationships_a ON entity_relationships (entity_a_id);
CREATE INDEX idx_entity_relationships_b ON entity_relationships (entity_b_id);
CREATE INDEX idx_redactions_status ON redactions (status);
CREATE INDEX idx_redactions_document ON redactions (document_id);
CREATE INDEX idx_timeline_date ON timeline_events (event_date);
CREATE INDEX idx_processing_jobs_status ON processing_jobs (status, priority DESC);
CREATE INDEX idx_documents_dataset ON documents (dataset_id);
CREATE INDEX idx_documents_classification ON documents (classification);

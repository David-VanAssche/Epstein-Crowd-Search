-- 00012_stats_views.sql

CREATE MATERIALIZED VIEW corpus_stats AS
SELECT
  (SELECT COUNT(*) FROM documents) AS total_documents,
  (SELECT COUNT(*) FROM documents WHERE processing_status = 'complete') AS processed_documents,
  (SELECT COUNT(*) FROM documents WHERE ocr_source IS NOT NULL AND ocr_source != 'pipeline') AS community_ocr_documents,
  (SELECT SUM(page_count) FROM documents) AS total_pages,
  (SELECT COUNT(*) FROM chunks) AS total_chunks,
  (SELECT COUNT(*) FROM chunks WHERE embedding_model = 'amazon.nova-multimodal-embeddings-v1:0') AS target_model_chunks,
  (SELECT COUNT(*) FROM chunks WHERE embedding_model IS NOT NULL AND embedding_model != 'amazon.nova-multimodal-embeddings-v1:0') AS community_model_chunks,
  (SELECT COUNT(*) FROM images) AS total_images,
  (SELECT COUNT(*) FROM videos) AS total_videos,
  (SELECT COUNT(*) FROM entities) AS total_entities,
  (SELECT COUNT(*) FROM entities WHERE source IS NOT NULL AND source != 'pipeline') AS community_entities,
  (SELECT COUNT(*) FROM entity_relationships) AS total_relationships,
  (SELECT COUNT(*) FROM redactions) AS total_redactions,
  (SELECT COUNT(*) FROM redactions WHERE status = 'confirmed') AS solved_redactions,
  (SELECT COUNT(*) FROM redactions WHERE status = 'corroborated') AS corroborated_redactions,
  (SELECT COUNT(*) FROM redaction_proposals) AS total_proposals,
  (SELECT COUNT(DISTINCT user_id) FROM redaction_proposals) AS total_contributors,
  (SELECT COUNT(*) FROM flights) AS total_flights,
  (SELECT COUNT(*) FROM data_sources WHERE status = 'ingested') AS sources_ingested,
  (SELECT COUNT(*) FROM data_sources) AS sources_total;
-- Refresh periodically: REFRESH MATERIALIZED VIEW corpus_stats;

-- 00019_multimodal_search.sql
-- Depends on: audio_files, audio_chunks (00018), chunks (00002), images (00002), video_chunks (00002)

-- Multimodal search across documents, images, video, and audio
-- Uses unified Nova 1024d embeddings — one query vector searches all modalities
CREATE OR REPLACE FUNCTION multimodal_search_rrf(
  query_text TEXT,
  query_embedding VECTOR(1024),
  match_count INTEGER DEFAULT 20,
  rrf_k INTEGER DEFAULT 60,
  search_documents BOOLEAN DEFAULT true,
  search_images BOOLEAN DEFAULT true,
  search_videos BOOLEAN DEFAULT true,
  search_audio BOOLEAN DEFAULT true,
  dataset_filter UUID DEFAULT NULL
)
RETURNS TABLE (
  result_id UUID,
  source_type TEXT,
  content TEXT,
  document_id UUID,
  page_number INTEGER,
  storage_path TEXT,
  filename TEXT,
  dataset_name TEXT,
  rrf_score FLOAT
)
LANGUAGE sql STABLE
AS $$
  WITH doc_semantic AS (
    SELECT c.id AS result_id, 'document'::TEXT AS source_type,
           c.content, c.document_id, c.page_number,
           NULL::TEXT AS storage_path, d.filename, ds.name AS dataset_name,
           ROW_NUMBER() OVER (ORDER BY c.content_embedding <=> query_embedding) AS rank
    FROM chunks c
    JOIN documents d ON d.id = c.document_id
    LEFT JOIN datasets ds ON ds.id = d.dataset_id
    WHERE search_documents AND c.content_embedding IS NOT NULL
      AND (dataset_filter IS NULL OR d.dataset_id = dataset_filter)
    ORDER BY c.content_embedding <=> query_embedding
    LIMIT match_count
  ),
  img_semantic AS (
    SELECT i.id AS result_id, 'image'::TEXT AS source_type,
           COALESCE(i.description, i.ocr_text, 'Image') AS content,
           i.document_id, i.page_number,
           i.storage_path, i.filename, ds.name AS dataset_name,
           ROW_NUMBER() OVER (ORDER BY i.visual_embedding <=> query_embedding) AS rank
    FROM images i
    LEFT JOIN datasets ds ON ds.id = i.dataset_id
    WHERE search_images AND i.visual_embedding IS NOT NULL
      AND (dataset_filter IS NULL OR i.dataset_id = dataset_filter)
    ORDER BY i.visual_embedding <=> query_embedding
    LIMIT match_count
  ),
  vid_semantic AS (
    SELECT vc.id AS result_id, 'video'::TEXT AS source_type,
           vc.content, v.document_id, NULL::INTEGER AS page_number,
           v.storage_path, v.filename, ds.name AS dataset_name,
           ROW_NUMBER() OVER (ORDER BY vc.content_embedding <=> query_embedding) AS rank
    FROM video_chunks vc
    JOIN videos v ON v.id = vc.video_id
    LEFT JOIN datasets ds ON ds.id = v.dataset_id
    WHERE search_videos AND vc.content_embedding IS NOT NULL
      AND (dataset_filter IS NULL OR v.dataset_id = dataset_filter)
    ORDER BY vc.content_embedding <=> query_embedding
    LIMIT match_count
  ),
  audio_semantic AS (
    SELECT ac.id AS result_id, 'audio'::TEXT AS source_type,
           ac.content, af.document_id, NULL::INTEGER AS page_number,
           af.storage_path, af.filename, ds.name AS dataset_name,
           ROW_NUMBER() OVER (ORDER BY ac.content_embedding <=> query_embedding) AS rank
    FROM audio_chunks ac
    JOIN audio_files af ON af.id = ac.audio_id
    LEFT JOIN datasets ds ON ds.id = af.dataset_id
    WHERE search_audio AND ac.content_embedding IS NOT NULL
      AND (dataset_filter IS NULL OR af.dataset_id = dataset_filter)
    ORDER BY ac.content_embedding <=> query_embedding
    LIMIT match_count
  ),
  all_results AS (
    SELECT *, 1.0 / (rrf_k + rank) AS score FROM doc_semantic
    UNION ALL
    SELECT *, 1.0 / (rrf_k + rank) AS score FROM img_semantic
    UNION ALL
    SELECT *, 1.0 / (rrf_k + rank) AS score FROM vid_semantic
    UNION ALL
    SELECT *, 1.0 / (rrf_k + rank) AS score FROM audio_semantic
  )
  SELECT result_id, source_type, content, document_id, page_number,
         storage_path, filename, dataset_name, score::FLOAT AS rrf_score
  FROM all_results
  ORDER BY score DESC
  LIMIT match_count;
$$;

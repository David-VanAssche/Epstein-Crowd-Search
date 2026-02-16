-- 00050: Recreate link_storage_objects() with extended timeout.
-- The original times out on 1.59M rows with Supabase's default 8s statement_timeout.

CREATE OR REPLACE FUNCTION link_storage_objects()
RETURNS TABLE(
  documents_linked BIGINT,
  images_linked BIGINT,
  videos_linked BIGINT,
  audio_linked BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _docs BIGINT;
  _imgs BIGINT;
  _vids BIGINT;
  _auds BIGINT;
BEGIN
  -- Extend timeout for this transaction (10 minutes)
  SET LOCAL statement_timeout = '600s';

  -- Link to documents by storage_path
  WITH updated AS (
    UPDATE storage_objects so
    SET linked_document_id = d.id
    FROM documents d
    WHERE so.path = d.storage_path
      AND so.linked_document_id IS NULL
    RETURNING so.id
  )
  SELECT count(*) INTO _docs FROM updated;

  -- Link to images by storage_path
  WITH updated AS (
    UPDATE storage_objects so
    SET linked_image_id = i.id
    FROM images i
    WHERE so.path = i.storage_path
      AND so.linked_image_id IS NULL
    RETURNING so.id
  )
  SELECT count(*) INTO _imgs FROM updated;

  -- Link to videos by storage_path
  WITH updated AS (
    UPDATE storage_objects so
    SET linked_video_id = v.id
    FROM videos v
    WHERE so.path = v.storage_path
      AND so.linked_video_id IS NULL
    RETURNING so.id
  )
  SELECT count(*) INTO _vids FROM updated;

  -- Link to audio_files by storage_path
  WITH updated AS (
    UPDATE storage_objects so
    SET linked_audio_id = a.id
    FROM audio_files a
    WHERE so.path = a.storage_path
      AND so.linked_audio_id IS NULL
    RETURNING so.id
  )
  SELECT count(*) INTO _auds FROM updated;

  RETURN QUERY SELECT _docs, _imgs, _vids, _auds;
END;
$$;

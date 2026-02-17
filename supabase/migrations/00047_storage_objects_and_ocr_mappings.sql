-- 00047: Storage inventory tables
--
-- Two new tables:
--   1. storage_objects — catalog of every file in the raw-archive bucket
--   2. community_ocr_mappings — links community OCR .txt files to EFTA documents

-- ---------------------------------------------------------------------------
-- 1. storage_objects — full bucket inventory
-- ---------------------------------------------------------------------------

CREATE TABLE storage_objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path TEXT NOT NULL UNIQUE,
  folder TEXT NOT NULL,
  subfolder TEXT,
  filename TEXT NOT NULL,
  extension TEXT,
  size_bytes BIGINT,
  linked_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  linked_image_id UUID REFERENCES images(id) ON DELETE SET NULL,
  linked_video_id UUID REFERENCES videos(id) ON DELETE SET NULL,
  linked_audio_id UUID REFERENCES audio_files(id) ON DELETE SET NULL,
  indexed_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_storage_objects_folder ON storage_objects (folder);
CREATE INDEX idx_storage_objects_folder_subfolder ON storage_objects (folder, subfolder);
CREATE INDEX idx_storage_objects_extension ON storage_objects (extension);
CREATE INDEX idx_storage_objects_linked_document ON storage_objects (linked_document_id) WHERE linked_document_id IS NOT NULL;
CREATE INDEX idx_storage_objects_linked_image ON storage_objects (linked_image_id) WHERE linked_image_id IS NOT NULL;
CREATE INDEX idx_storage_objects_linked_video ON storage_objects (linked_video_id) WHERE linked_video_id IS NOT NULL;
CREATE INDEX idx_storage_objects_linked_audio ON storage_objects (linked_audio_id) WHERE linked_audio_id IS NOT NULL;

ALTER TABLE storage_objects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON storage_objects FOR SELECT USING (true);

-- ---------------------------------------------------------------------------
-- 2. community_ocr_mappings — community OCR text → EFTA documents
-- ---------------------------------------------------------------------------

CREATE TABLE community_ocr_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  efta_number TEXT,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  ocr_applied BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_community_ocr_source ON community_ocr_mappings (source);
CREATE INDEX idx_community_ocr_efta ON community_ocr_mappings (efta_number) WHERE efta_number IS NOT NULL;
CREATE INDEX idx_community_ocr_document ON community_ocr_mappings (document_id) WHERE document_id IS NOT NULL;
CREATE INDEX idx_community_ocr_unapplied ON community_ocr_mappings (document_id) WHERE document_id IS NOT NULL AND ocr_applied = false;

ALTER TABLE community_ocr_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON community_ocr_mappings FOR SELECT USING (true);

-- ---------------------------------------------------------------------------
-- 3. link_storage_objects() — SQL-based linking (avoids per-row REST calls)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION link_storage_objects()
RETURNS TABLE(
  documents_linked BIGINT,
  images_linked BIGINT,
  videos_linked BIGINT,
  audio_linked BIGINT
)
LANGUAGE plpgsql
AS $$
DECLARE
  _docs BIGINT;
  _imgs BIGINT;
  _vids BIGINT;
  _auds BIGINT;
BEGIN
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

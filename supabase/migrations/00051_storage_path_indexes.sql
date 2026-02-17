-- 00051: Add indexes on storage_path columns for efficient JOIN linking.
-- These make link_storage_objects() complete in seconds instead of timing out.

CREATE INDEX IF NOT EXISTS idx_documents_storage_path
  ON documents (storage_path);

CREATE INDEX IF NOT EXISTS idx_images_storage_path_lookup
  ON images (storage_path);

CREATE INDEX IF NOT EXISTS idx_videos_storage_path_lookup
  ON videos (storage_path);

CREATE INDEX IF NOT EXISTS idx_audio_files_storage_path_lookup
  ON audio_files (storage_path);

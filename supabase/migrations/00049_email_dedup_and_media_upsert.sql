-- 00049_email_dedup_and_media_upsert.sql
-- Unique constraints for idempotent imports of emails and media files.

-- 1. Unique constraint on emails.message_id for deduplication.
--    NULL values are excluded (only non-null message_ids must be unique).
CREATE UNIQUE INDEX IF NOT EXISTS idx_emails_message_id_unique
  ON emails (message_id) WHERE message_id IS NOT NULL;

-- 2. Unique constraints on media tables storage_path for idempotent upserts.
CREATE UNIQUE INDEX IF NOT EXISTS idx_images_storage_path_unique
  ON images (storage_path);
CREATE UNIQUE INDEX IF NOT EXISTS idx_videos_storage_path_unique
  ON videos (storage_path);
CREATE UNIQUE INDEX IF NOT EXISTS idx_audio_files_storage_path_unique
  ON audio_files (storage_path);

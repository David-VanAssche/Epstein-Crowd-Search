// lib/utils/storage.ts
import { createClient } from '@/lib/supabase/server'

const DEFAULT_EXPIRY_SECONDS = 3600 // 1 hour

/**
 * Generate a signed URL for accessing a file in Supabase Storage.
 * Files are stored in the 'documents' bucket by default.
 */
export async function getSignedUrl(
  storagePath: string,
  bucket: string = 'documents',
  expiresIn: number = DEFAULT_EXPIRY_SECONDS
): Promise<string | null> {
  const supabase = await createClient()

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(storagePath, expiresIn)

  if (error) {
    console.error('[Storage] Failed to create signed URL:', error.message)
    return null
  }

  return data.signedUrl
}

/**
 * Generate signed URLs for multiple files in batch.
 */
export async function getSignedUrls(
  storagePaths: string[],
  bucket: string = 'documents',
  expiresIn: number = DEFAULT_EXPIRY_SECONDS
): Promise<Map<string, string>> {
  const supabase = await createClient()
  const urlMap = new Map<string, string>()

  // Supabase supports batch signed URL generation
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(storagePaths, expiresIn)

  if (error) {
    console.error('[Storage] Failed to create batch signed URLs:', error.message)
    return urlMap
  }

  for (const item of data || []) {
    if (item.signedUrl && item.path) {
      urlMap.set(item.path, item.signedUrl)
    }
  }

  return urlMap
}

/**
 * Get the public URL for a file (if bucket is public).
 */
export async function getPublicUrl(
  storagePath: string,
  bucket: string = 'documents'
): Promise<string> {
  const supabase = await createClient()

  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath)

  return data.publicUrl
}

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

/**
 * Service-role Supabase client for server-side operations that bypass RLS.
 * Use only in API routes, webhooks, and batch scripts — never on the client.
 */
export function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// app/api/sources/route.ts
import { createClient } from '@/lib/supabase/server'
import { success, handleApiError } from '@/lib/api/responses'

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: sources, error } = await supabase
      .from('data_sources')
      .select('id, name, source_type, url, data_type, status, expected_count, ingested_count, failed_count, error_message, priority, ingested_at')
      .order('priority', { ascending: false })
      .order('name', { ascending: true })

    if (error) {
      throw new Error(`Failed to fetch data sources: ${error.message}`)
    }

    return success(sources || [])
  } catch (err) {
    return handleApiError(err)
  }
}

// app/api/doj-releases/route.ts
import { createClient } from '@/lib/supabase/server'
import { success, handleApiError } from '@/lib/api/responses'

export async function GET() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('doj_releases')
      .select('*')
      .order('release_date', { ascending: false })
      .limit(50)

    if (error) throw new Error(`DOJ releases query failed: ${error.message}`)

    return success(data || [])
  } catch (err) {
    return handleApiError(err)
  }
}

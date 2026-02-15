// app/api/datasets/route.ts
import { createClient } from '@/lib/supabase/server'
import { success, handleApiError } from '@/lib/api/responses'

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: datasets, error } = await supabase
      .from('datasets')
      .select('*')
      .order('dataset_number', { ascending: true })

    if (error) throw new Error(`Datasets query failed: ${error.message}`)

    return success(datasets || [])
  } catch (err) {
    return handleApiError(err)
  }
}

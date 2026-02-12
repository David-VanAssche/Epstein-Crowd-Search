// app/api/discoveries/today-in-history/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, handleApiError } from '@/lib/api/responses'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const today = new Date()
    const month = today.getMonth() + 1
    const day = today.getDate()

    // Find documents with extracted dates matching today's month and day.
    // We fetch recent dated documents and filter in JS since
    // Supabase JS client doesn't support EXTRACT(). In production,
    // use an RPC function for server-side filtering.
    const { data: documents, error } = await supabase
      .from('documents')
      .select('id, filename, classification, date_extracted, page_count')
      .not('date_extracted', 'is', null)
      .limit(500)

    if (error) {
      throw new Error(`Today in history query failed: ${error.message}`)
    }

    // Filter for month/day match
    const matches = (documents || []).filter((doc: any) => {
      if (!doc.date_extracted) return false
      const docDate = new Date(doc.date_extracted)
      return docDate.getMonth() + 1 === month && docDate.getDate() === day
    })

    return success(
      matches.map((doc: any) => ({
        id: doc.id,
        filename: doc.filename,
        classification: doc.classification,
        date: doc.date_extracted,
        page_count: doc.page_count,
      }))
    )
  } catch (err) {
    return handleApiError(err)
  }
}

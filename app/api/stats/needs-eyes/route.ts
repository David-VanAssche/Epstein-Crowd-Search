// app/api/stats/needs-eyes/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, handleApiError } from '@/lib/api/responses'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const dataset = searchParams.get('dataset')
    const difficulty = searchParams.get('difficulty')
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50)

    const supabase = await createClient()

    let query = supabase
      .from('documents')
      .select('id, filename, dataset_number, page_count, entity_count, metadata')
      .order('entity_count', { ascending: false, nullsFirst: false })
      .order('page_count', { ascending: false, nullsFirst: false })
      .limit(limit)

    if (dataset && dataset !== 'all') {
      query = query.eq('dataset_number', parseInt(dataset, 10))
    }

    const { data: docs, error } = await query

    if (error) {
      return success([])
    }

    // Map to NeedsEyesDocument shape
    const results = (docs ?? [])
      .map((doc) => {
        const pageCount = doc.page_count ?? 0
        const difficultyEstimate: 'easy' | 'medium' | 'hard' =
          pageCount < 5 ? 'easy' : pageCount <= 20 ? 'medium' : 'hard'

        return {
          id: doc.id,
          filename: doc.filename ?? `Document ${doc.id.slice(0, 8)}`,
          dataset_name: doc.dataset_number ? `Dataset ${doc.dataset_number}` : null,
          entity_count: doc.entity_count ?? 0,
          redaction_count: 0,
          review_count: 0,
          priority_score: (doc.entity_count ?? 0) + (pageCount * 0.1),
          difficulty_estimate: difficultyEstimate,
        }
      })
      .filter((doc) => {
        if (difficulty && difficulty !== 'all') {
          return doc.difficulty_estimate === difficulty
        }
        return true
      })

    return success(results)
  } catch (err) {
    return handleApiError(err)
  }
}

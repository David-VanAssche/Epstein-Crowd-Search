// app/api/discoveries/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { paginationSchema, parseSearchParams } from '@/lib/api/schemas'
import { paginated, handleApiError } from '@/lib/api/responses'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const queryParams = parseSearchParams(url)
    const input = paginationSchema.parse(queryParams)
    const typeFilter = url.searchParams.get('type')

    const supabase = await createClient()
    const offset = (input.page - 1) * input.per_page

    // Discoveries are composed from multiple sources:
    // 1. Recent confirmed redaction solves
    // 2. Recently verified entity relationships
    const discoveries: any[] = []

    // Redaction solves
    if (!typeFilter || typeFilter === 'redaction_solved') {
      const { data: solves } = await supabase
        .from('redactions')
        .select(
          `
          id,
          resolved_text,
          surrounding_text,
          resolved_at,
          cascade_count,
          document_id,
          page_number,
          documents ( filename )
        `
        )
        .eq('status', 'confirmed')
        .not('resolved_at', 'is', null)
        .order('resolved_at', { ascending: false })
        .range(offset, offset + input.per_page - 1)

      if (solves) {
        discoveries.push(
          ...solves.map((s: any) => ({
            id: s.id,
            type: 'redaction_solved' as const,
            title: `Redaction Solved: "${s.resolved_text}"`,
            description: `The redacted text in ${s.documents?.filename || 'a document'} (page ${s.page_number || '?'}) has been identified.`,
            user_display_name: null,
            cascade_count: s.cascade_count || 0,
            created_at: s.resolved_at,
          }))
        )
      }
    }

    // Sort by date
    discoveries.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    const { count } = await supabase
      .from('redactions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'confirmed')

    return paginated(
      discoveries.slice(0, input.per_page),
      input.page,
      input.per_page,
      count || 0
    )
  } catch (err) {
    return handleApiError(err)
  }
}

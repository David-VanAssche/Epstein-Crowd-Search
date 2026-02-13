// app/api/contradictions/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { contradictionQuerySchema, contradictionCreateSchema, parseSearchParams } from '@/lib/api/schemas'
import { success, paginated, unauthorized, handleApiError } from '@/lib/api/responses'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const params = parseSearchParams(url)
    const input = contradictionQuerySchema.parse(params)
    const offset = (input.page - 1) * input.per_page

    const supabase = await createClient()

    let query = supabase
      .from('contradictions')
      .select(
        `
        id, claim_a, claim_b, severity, description, verify_count, dispute_count,
        is_verified, entity_ids, tags, created_at,
        claim_a_doc:documents!claim_a_document_id(filename),
        claim_b_doc:documents!claim_b_document_id(filename)
      `,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })

    if (input.severity) query = query.eq('severity', input.severity)
    if (input.is_verified !== undefined) query = query.eq('is_verified', input.is_verified)
    if (input.entity_id) query = query.contains('entity_ids', [input.entity_id])

    query = query.range(offset, offset + input.per_page - 1)

    const { data, count, error } = await query
    if (error) throw new Error(`Contradictions query failed: ${error.message}`)

    const items = (data || []).map((c: any) => ({
      id: c.id,
      claim_a: c.claim_a,
      claim_b: c.claim_b,
      severity: c.severity,
      description: c.description,
      verify_count: c.verify_count,
      dispute_count: c.dispute_count,
      is_verified: c.is_verified,
      entity_ids: c.entity_ids || [],
      tags: c.tags || [],
      created_at: c.created_at,
      claim_a_document_filename: c.claim_a_doc?.filename || null,
      claim_b_document_filename: c.claim_b_doc?.filename || null,
      creator_display_name: null,
    }))

    return paginated(items, input.page, input.per_page, count || 0)
  } catch (err) {
    return handleApiError(err)
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return unauthorized()

    const body = await request.json()
    const input = contradictionCreateSchema.parse(body)

    const { data, error } = await supabase
      .from('contradictions')
      .insert({
        created_by: user.id,
        ...input,
      })
      .select('id')
      .single()

    if (error) throw new Error(`Create contradiction failed: ${error.message}`)

    return success(data)
  } catch (err) {
    return handleApiError(err)
  }
}

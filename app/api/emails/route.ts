// app/api/emails/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { emailQuerySchema, parseSearchParams } from '@/lib/api/schemas'
import { paginated, handleApiError } from '@/lib/api/responses'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const params = parseSearchParams(url)
    const input = emailQuerySchema.parse(params)
    const offset = (input.page - 1) * input.per_page

    const supabase = await createClient()

    let query = supabase
      .from('emails')
      .select(
        `
        id, subject, from_raw, to_raw, sent_date, has_attachments,
        thread_id, document_id, confidence,
        from_entity:entities!from_entity_id(name),
        documents(filename)
      `,
        { count: 'exact' }
      )
      .order('sent_date', { ascending: false, nullsFirst: false })

    if (input.search) {
      query = query.textSearch('body_tsv', input.search, { type: 'websearch' })
    }
    if (input.entity_id) {
      query = query.or(
        `from_entity_id.eq.${input.entity_id},to_entity_ids.cs.{${input.entity_id}},cc_entity_ids.cs.{${input.entity_id}}`
      )
    }
    if (input.date_from) {
      query = query.gte('sent_date', input.date_from)
    }
    if (input.date_to) {
      query = query.lte('sent_date', input.date_to)
    }
    if (input.has_attachments !== undefined) {
      query = query.eq('has_attachments', input.has_attachments)
    }
    if (input.thread_id) {
      query = query.eq('thread_id', input.thread_id)
    }

    query = query.range(offset, offset + input.per_page - 1)

    const { data, count, error } = await query

    if (error) throw new Error(`Emails query failed: ${error.message}`)

    const emails = (data || []).map((e: any) => ({
      id: e.id,
      subject: e.subject,
      from_raw: e.from_raw,
      from_entity_name: e.from_entity?.name || null,
      to_raw: e.to_raw || [],
      sent_date: e.sent_date,
      has_attachments: e.has_attachments,
      thread_id: e.thread_id,
      document_id: e.document_id,
      document_filename: e.documents?.filename || null,
      confidence: e.confidence,
    }))

    return paginated(emails, input.page, input.per_page, count || 0)
  } catch (err) {
    return handleApiError(err)
  }
}

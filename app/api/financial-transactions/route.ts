// app/api/financial-transactions/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { financialQuerySchema, parseSearchParams } from '@/lib/api/schemas'
import { paginated, handleApiError } from '@/lib/api/responses'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const params = parseSearchParams(url)
    const input = financialQuerySchema.parse(params)
    const offset = (input.page - 1) * input.per_page

    const supabase = await createClient()

    let query = supabase
      .from('financial_transactions')
      .select(
        `
        id, from_raw, to_raw, amount, currency, transaction_date,
        transaction_type, description, is_suspicious, suspicious_reasons,
        shell_company_involved, document_id, confidence,
        from_entity:entities!from_entity_id(name),
        to_entity:entities!to_entity_id(name),
        documents(filename)
      `,
        { count: 'exact' }
      )
      .order('transaction_date', { ascending: false, nullsFirst: false })

    if (input.entity_id) {
      query = query.or(`from_entity_id.eq.${input.entity_id},to_entity_id.eq.${input.entity_id}`)
    }
    if (input.min_amount !== undefined) {
      query = query.gte('amount', input.min_amount)
    }
    if (input.max_amount !== undefined) {
      query = query.lte('amount', input.max_amount)
    }
    if (input.transaction_type) {
      query = query.eq('transaction_type', input.transaction_type)
    }
    if (input.is_suspicious !== undefined) {
      query = query.eq('is_suspicious', input.is_suspicious)
    }
    if (input.date_from) {
      query = query.gte('transaction_date', input.date_from)
    }
    if (input.date_to) {
      query = query.lte('transaction_date', input.date_to)
    }

    query = query.range(offset, offset + input.per_page - 1)

    const { data, count, error } = await query

    if (error) throw new Error(`Financial query failed: ${error.message}`)

    const transactions = (data || []).map((t: any) => ({
      id: t.id,
      from_raw: t.from_raw,
      from_entity_name: t.from_entity?.name || null,
      to_raw: t.to_raw,
      to_entity_name: t.to_entity?.name || null,
      amount: t.amount ? Number(t.amount) : null,
      currency: t.currency,
      transaction_date: t.transaction_date,
      transaction_type: t.transaction_type,
      description: t.description,
      is_suspicious: t.is_suspicious,
      suspicious_reasons: t.suspicious_reasons || [],
      shell_company_involved: t.shell_company_involved,
      document_id: t.document_id,
      document_filename: t.documents?.filename || null,
    }))

    return paginated(transactions, input.page, input.per_page, count || 0)
  } catch (err) {
    return handleApiError(err)
  }
}

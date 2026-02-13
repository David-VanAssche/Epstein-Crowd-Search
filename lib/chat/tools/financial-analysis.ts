// lib/chat/tools/financial-analysis.ts
import type { ChatTool } from '../chat-orchestrator'

export const financialAnalysisTool: ChatTool = {
  name: 'financial_analysis',
  description:
    'Analyze financial transactions — find suspicious transactions, money flows between entities, and financial patterns.',
  parameters: {
    type: 'object',
    properties: {
      entity_name: { type: 'string', description: 'Name of person/entity to analyze' },
      suspicious_only: { type: 'boolean', description: 'Only show suspicious transactions (default false)' },
      min_amount: { type: 'number', description: 'Minimum transaction amount (default 0)' },
      limit: { type: 'number', description: 'Max results (default 20)' },
    },
    required: [],
  },
  execute: async (params, supabase) => {
    const entityName = params.entity_name ? String(params.entity_name) : null
    const suspiciousOnly = !!params.suspicious_only
    const minAmount = Number(params.min_amount) || 0
    const limit = Number(params.limit) || 20

    let query = supabase
      .from('financial_transactions')
      .select(`
        id, from_raw, to_raw, amount, currency, transaction_date,
        transaction_type, description, is_suspicious, suspicious_reasons,
        shell_company_involved, document_id,
        from_entity:entities!from_entity_id(name),
        to_entity:entities!to_entity_id(name)
      `)
      .order('amount', { ascending: false, nullsFirst: false })
      .limit(limit)

    if (suspiciousOnly) {
      query = query.eq('is_suspicious', true)
    }

    if (minAmount > 0) {
      query = query.gte('amount', minAmount)
    }

    if (entityName) {
      // Find entity first
      const { data: entity } = await supabase.from('entities').select('id, name')
        .ilike('name', `%${entityName}%`).order('mention_count', { ascending: false }).limit(1).single()

      if (entity) {
        const entityId = (entity as any).id
        query = query.or(`from_entity_id.eq.${entityId},to_entity_id.eq.${entityId}`)
      }
    }

    const { data: transactions, error } = await query

    if (error) return `Financial analysis error: ${error.message}`
    if (!transactions || transactions.length === 0) {
      return entityName
        ? `No financial transactions found involving "${entityName}".`
        : 'No financial transactions found in the database.'
    }

    let result = `Financial transactions (${transactions.length} results):\n\n`
    let totalAmount = 0
    let suspiciousCount = 0

    for (const tx of transactions) {
      const t = tx as any
      const amount = t.amount ? `$${Number(t.amount).toLocaleString()}` : 'unknown amount'
      const date = t.transaction_date || 'unknown date'
      const from = t.from_raw || 'unknown'
      const to = t.to_raw || 'unknown'

      result += `- [${date}] ${from} → ${to}: ${amount} (${t.transaction_type || 'unknown type'})`
      if (t.is_suspicious) {
        result += ` [SUSPICIOUS: ${(t.suspicious_reasons || []).join('; ')}]`
        suspiciousCount++
      }
      if (t.shell_company_involved) result += ' [SHELL COMPANY]'
      result += `\n  ${t.description || ''} (doc_id: ${t.document_id})\n`

      if (t.amount) totalAmount += Number(t.amount)
    }

    result += `\nSummary: ${transactions.length} transactions, total $${totalAmount.toLocaleString()}, ${suspiciousCount} flagged as suspicious`

    return result
  },
}

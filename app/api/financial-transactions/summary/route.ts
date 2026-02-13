// app/api/financial-transactions/summary/route.ts
import { createClient } from '@/lib/supabase/server'
import { success, handleApiError } from '@/lib/api/responses'

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: transactions, error } = await supabase
      .from('financial_transactions')
      .select('amount, currency, transaction_type, transaction_date, is_suspicious, shell_company_involved, from_raw, to_raw')

    if (error) throw new Error(`Summary query failed: ${error.message}`)

    const rows = transactions || []
    let totalAmount = 0
    let suspiciousCount = 0
    let shellCount = 0
    const byType: Record<string, { count: number; total: number }> = {}
    const byYear: Record<number, { count: number; total: number }> = {}
    const senderCounts: Record<string, { count: number; total: number }> = {}
    const receiverCounts: Record<string, { count: number; total: number }> = {}

    for (const row of rows) {
      const t = row as any
      const amount = t.amount ? Number(t.amount) : 0
      totalAmount += amount

      if (t.is_suspicious) suspiciousCount++
      if (t.shell_company_involved) shellCount++

      const type = t.transaction_type || 'unknown'
      if (!byType[type]) byType[type] = { count: 0, total: 0 }
      byType[type].count++
      byType[type].total += amount

      if (t.transaction_date) {
        const year = new Date(t.transaction_date).getFullYear()
        if (!byYear[year]) byYear[year] = { count: 0, total: 0 }
        byYear[year].count++
        byYear[year].total += amount
      }

      if (t.from_raw) {
        if (!senderCounts[t.from_raw]) senderCounts[t.from_raw] = { count: 0, total: 0 }
        senderCounts[t.from_raw].count++
        senderCounts[t.from_raw].total += amount
      }
      if (t.to_raw) {
        if (!receiverCounts[t.to_raw]) receiverCounts[t.to_raw] = { count: 0, total: 0 }
        receiverCounts[t.to_raw].count++
        receiverCounts[t.to_raw].total += amount
      }
    }

    return success({
      total_transactions: rows.length,
      total_amount: Math.round(totalAmount),
      suspicious_count: suspiciousCount,
      shell_company_count: shellCount,
      by_type: Object.entries(byType)
        .map(([type, data]) => ({ type, ...data }))
        .sort((a, b) => b.total - a.total),
      by_year: Object.entries(byYear)
        .map(([year, data]) => ({ year: Number(year), ...data }))
        .sort((a, b) => a.year - b.year),
      top_senders: Object.entries(senderCounts)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 20),
      top_receivers: Object.entries(receiverCounts)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 20),
    })
  } catch (err) {
    return handleApiError(err)
  }
}

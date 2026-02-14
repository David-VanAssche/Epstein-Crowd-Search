import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  const { data: campaigns, error } = await supabase
    .from('processing_campaigns')
    .select('*')
    .order('slug')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const enriched = (campaigns ?? []).map((c) => {
    const total_cost = c.total_units * c.cost_per_unit
    return {
      ...c,
      progress_percent: c.total_units > 0
        ? Math.round((c.total_units_processed / c.total_units) * 100)
        : 0,
      funding_percent: total_cost > 0
        ? Math.round((c.funded_amount / total_cost) * 100)
        : 0,
      remaining_cost: Math.max(0, total_cost - c.funded_amount),
      total_cost,
    }
  })

  const totals = {
    total_funded: enriched.reduce((s, c) => s + Number(c.funded_amount), 0),
    total_spent: enriched.reduce((s, c) => s + Number(c.spent_amount), 0),
    total_units: enriched.reduce((s, c) => s + c.total_units, 0),
    total_processed: enriched.reduce((s, c) => s + c.total_units_processed, 0),
    overall_progress: 0,
  }
  const totalUnits = totals.total_units
  totals.overall_progress = totalUnits > 0
    ? Math.round((totals.total_processed / totalUnits) * 100)
    : 0

  return NextResponse.json({ campaigns: enriched, totals })
}

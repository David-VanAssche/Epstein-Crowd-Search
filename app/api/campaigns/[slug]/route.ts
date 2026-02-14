import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: campaign, error } = await supabase
    .from('processing_campaigns')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error || !campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }

  const total_cost = campaign.total_units * campaign.cost_per_unit
  const enriched = {
    ...campaign,
    progress_percent: campaign.total_units > 0
      ? Math.round((campaign.total_units_processed / campaign.total_units) * 100)
      : 0,
    funding_percent: total_cost > 0
      ? Math.round((campaign.funded_amount / total_cost) * 100)
      : 0,
    remaining_cost: Math.max(0, total_cost - campaign.funded_amount),
    total_cost,
  }

  // Recent contributions (last 10 paid)
  const { data: contributions } = await supabase
    .from('contributions')
    .select('id, amount_cents, donor_display_name, is_anonymous, created_at')
    .eq('campaign_id', campaign.id)
    .eq('status', 'paid')
    .order('created_at', { ascending: false })
    .limit(10)

  // Recent spend log entries
  const { data: spend } = await supabase
    .from('processing_spend_log')
    .select('id, amount, service, description, pages_processed, created_at')
    .eq('campaign_id', campaign.id)
    .order('created_at', { ascending: false })
    .limit(10)

  return NextResponse.json({
    campaign: enriched,
    recent_contributions: contributions ?? [],
    recent_spend: spend ?? [],
  })
}

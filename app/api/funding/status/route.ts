// app/api/funding/status/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('funding_status')
    .select('*')
    .single()

  if (error || !data) {
    return NextResponse.json({
      raised: 0,
      goal: 16000,
      percentage: 0,
      donor_count: 0,
      last_updated: new Date().toISOString(),
    })
  }

  return NextResponse.json({
    raised: data.raised_amount ?? 0,
    goal: data.goal_amount ?? 16000,
    percentage: data.goal_amount
      ? Math.min(100, Math.round(((data.raised_amount ?? 0) / data.goal_amount) * 100))
      : 0,
    donor_count: data.donor_count ?? 0,
    last_updated: data.updated_at ?? new Date().toISOString(),
  })
}

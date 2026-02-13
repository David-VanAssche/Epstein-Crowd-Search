// app/api/funding/spend-log/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const VALID_SERVICES = ['openai', 'anthropic', 'ocr', 'embedding', 'whisper', 'supabase']

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20') || 20))
  const service = searchParams.get('service')
  const date_from = searchParams.get('date_from')
  const date_to = searchParams.get('date_to')

  if (service && !VALID_SERVICES.includes(service)) {
    return NextResponse.json({ error: 'Invalid service filter' }, { status: 400 })
  }

  const supabase = await createClient()

  let query = supabase
    .from('processing_spend_log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (service) {
    query = query.eq('service', service)
  }
  if (date_from) {
    query = query.gte('created_at', date_from)
  }
  if (date_to) {
    query = query.lte('created_at', date_to)
  }

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ entries: [], total: 0, page, limit, total_pages: 0 })
  }

  return NextResponse.json({
    entries: data ?? [],
    total: count ?? 0,
    page,
    limit,
    total_pages: Math.ceil((count ?? 0) / limit),
  })
}

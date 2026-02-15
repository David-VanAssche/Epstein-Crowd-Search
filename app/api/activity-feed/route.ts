import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50)

  try {
    const supabase = await createClient()
    const items: Array<{
      id: string
      type: string
      description: string
      timestamp: string
      link: string | null
      actor: string | null
    }> = []

    // Fetch from multiple tables and unify
    if (!type || type === 'redaction') {
      const { data } = await supabase
        .from('redaction_proposals')
        .select('id, proposed_text, created_at, document_id')
        .order('created_at', { ascending: false })
        .limit(limit)
      if (data) {
        for (const row of data) {
          items.push({
            id: `redaction-${row.id}`,
            type: 'redaction',
            description: `New redaction proposal: "${(row.proposed_text ?? '').slice(0, 60)}..."`,
            timestamp: row.created_at,
            link: row.document_id ? `/document/${row.document_id}` : null,
            actor: null,
          })
        }
      }
    }

    if (!type || type === 'connection') {
      const { data } = await supabase
        .from('entity_relationships')
        .select('id, relationship_type, created_at, entity_a_id, entity_b_id')
        .order('created_at', { ascending: false })
        .limit(limit)
      if (data) {
        for (const row of data) {
          items.push({
            id: `connection-${row.id}`,
            type: 'connection',
            description: `New ${row.relationship_type ?? 'connection'} relationship discovered`,
            timestamp: row.created_at,
            link: `/graph?entity=${row.entity_a_id}`,
            actor: null,
          })
        }
      }
    }

    if (!type || type === 'processing') {
      const { data } = await supabase
        .from('documents')
        .select('id, filename, created_at')
        .order('created_at', { ascending: false })
        .limit(limit)
      if (data) {
        for (const row of data) {
          items.push({
            id: `processing-${row.id}`,
            type: 'processing',
            description: `Document processed: ${row.filename ?? 'Unknown'}`,
            timestamp: row.created_at,
            link: `/document/${row.id}`,
            actor: null,
          })
        }
      }
    }

    // Sort by timestamp, most recent first
    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    return NextResponse.json({ data: items.slice(0, limit) })
  } catch (error) {
    // Return empty feed on any error (tables may not exist yet)
    return NextResponse.json({ data: [] })
  }
}

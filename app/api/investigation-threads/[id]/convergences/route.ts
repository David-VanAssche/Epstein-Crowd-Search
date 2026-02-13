// app/api/investigation-threads/[id]/convergences/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, notFound, error as errorResponse, handleApiError } from '@/lib/api/responses'

interface RouteParams {
  params: Promise<{ id: string }>
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    if (!UUID_RE.test(id)) return errorResponse('Invalid thread ID format')
    const supabase = await createClient()

    // Verify thread exists
    const { data: thread } = await supabase
      .from('investigation_threads')
      .select('id, title')
      .eq('id', id)
      .single()

    if (!thread) return notFound('Investigation thread not found')

    // Get convergences where this thread is either thread_a or thread_b
    const { data: convergences, error } = await supabase
      .from('thread_convergences')
      .select(`
        id, thread_a_id, thread_b_id, overlap_type, description,
        shared_entity_ids, created_at,
        thread_a:investigation_threads!thread_a_id(id, title),
        thread_b:investigation_threads!thread_b_id(id, title)
      `)
      .or(`thread_a_id.eq.${id},thread_b_id.eq.${id}`)
      .order('created_at', { ascending: false })

    if (error) throw new Error(`Convergences query failed: ${error.message}`)

    const items = (convergences || []).map((c: any) => ({
      id: c.id,
      thread_a_id: c.thread_a_id,
      thread_b_id: c.thread_b_id,
      thread_a_title: c.thread_a?.title || null,
      thread_b_title: c.thread_b?.title || null,
      overlap_type: c.overlap_type,
      description: c.description,
      shared_entity_ids: c.shared_entity_ids || [],
      created_at: c.created_at,
      // Identify the "other" thread for convenience
      related_thread_id: c.thread_a_id === id ? c.thread_b_id : c.thread_a_id,
      related_thread_title: c.thread_a_id === id ? c.thread_b?.title : c.thread_a?.title,
    }))

    return success(items)
  } catch (err) {
    return handleApiError(err)
  }
}

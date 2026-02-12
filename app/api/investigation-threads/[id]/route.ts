// app/api/investigation-threads/[id]/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { threadItemSchema, threadCreateSchema } from '@/lib/api/schemas'
import { success, notFound, forbidden, handleApiError } from '@/lib/api/responses'
import { requireAuth, getUser } from '@/lib/auth/middleware'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: thread, error } = await supabase
      .from('investigation_threads')
      .select(
        `
        *,
        user_profiles ( display_name, avatar_url )
      `
      )
      .eq('id', id)
      .single()

    if (error || !thread) {
      return notFound('Thread not found')
    }

    // Check access for private threads
    if (!thread.is_public) {
      const user = await getUser()
      if (!user || user.id !== thread.user_id) {
        return notFound('Thread not found')
      }
    }

    // Fetch thread items
    const { data: items } = await supabase
      .from('investigation_thread_items')
      .select(
        `
        *,
        user_profiles ( display_name, avatar_url )
      `
      )
      .eq('thread_id', id)
      .order('position', { ascending: true })

    return success({
      ...thread,
      user_display_name: (thread as any).user_profiles?.display_name,
      user_avatar_url: (thread as any).user_profiles?.avatar_url,
      items: items || [],
    })
  } catch (err) {
    return handleApiError(err)
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const userOrResponse = await requireAuth()
    if (userOrResponse instanceof Response) return userOrResponse
    const user = userOrResponse

    const { id } = await params
    const body = await request.json()
    // Validate with partial schema — all fields optional for PATCH-like updates
    const input = threadCreateSchema.partial().parse(body)

    const supabase = await createClient()

    // Verify ownership
    const { data: thread } = await supabase
      .from('investigation_threads')
      .select('user_id')
      .eq('id', id)
      .maybeSingle()

    if (!thread || thread.user_id !== user.id) {
      return forbidden('Only the thread owner can update it')
    }

    const { data: updated, error } = await supabase
      .from('investigation_threads')
      .update({
        ...(input.title && { title: input.title }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.is_public !== undefined && { is_public: input.is_public }),
        ...(input.tags && { tags: input.tags }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update thread: ${error.message}`)
    }

    return success(updated)
  } catch (err) {
    return handleApiError(err)
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const userOrResponse = await requireAuth()
    if (userOrResponse instanceof Response) return userOrResponse
    const user = userOrResponse

    const { id } = await params
    const body = await request.json()
    const input = threadItemSchema.parse(body)

    const supabase = await createClient()

    // Verify thread exists and user has access
    const { data: thread } = await supabase
      .from('investigation_threads')
      .select('user_id, is_public')
      .eq('id', id)
      .maybeSingle()

    if (!thread) {
      return notFound('Thread not found')
    }

    // Only thread owner or contributors to public threads can add items
    if (!thread.is_public && thread.user_id !== user.id) {
      return forbidden('Only the thread owner can add items to private threads')
    }

    // Get the next position
    const { count } = await supabase
      .from('investigation_thread_items')
      .select('id', { count: 'exact', head: true })
      .eq('thread_id', id)

    const { data: item, error } = await supabase
      .from('investigation_thread_items')
      .insert({
        thread_id: id,
        user_id: user.id,
        item_type: input.item_type,
        target_id: input.target_id || null,
        note: input.note || null,
        position: (count || 0) + 1,
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to add thread item: ${error.message}`)
    }

    // Update thread timestamp
    await supabase
      .from('investigation_threads')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', id)

    return success(item)
  } catch (err) {
    return handleApiError(err)
  }
}

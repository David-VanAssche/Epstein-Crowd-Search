// app/api/notifications/route.ts
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { paginationSchema, parseSearchParams } from '@/lib/api/schemas'
import { success, paginated, handleApiError } from '@/lib/api/responses'
import { requireAuth } from '@/lib/auth/middleware'

const markReadSchema = z.object({
  notification_ids: z.array(z.string().uuid()).max(100).optional(),
  mark_all: z.boolean().optional(),
}).refine(
  (data) => data.mark_all || (data.notification_ids && data.notification_ids.length > 0),
  { message: 'Either mark_all or notification_ids must be provided' }
)

export async function GET(request: NextRequest) {
  try {
    const userOrResponse = await requireAuth()
    if (userOrResponse instanceof Response) return userOrResponse
    const user = userOrResponse

    const url = new URL(request.url)
    const queryParams = parseSearchParams(url)
    const pagination = paginationSchema.parse(queryParams)

    const supabase = await createClient()
    const offset = (pagination.page - 1) * pagination.per_page

    // Get notifications for this user
    const { data: notifications, count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + pagination.per_page - 1)

    if (error) {
      throw new Error(`Notifications query failed: ${error.message}`)
    }

    return paginated(notifications || [], pagination.page, pagination.per_page, count || 0)
  } catch (err) {
    return handleApiError(err)
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userOrResponse = await requireAuth()
    if (userOrResponse instanceof Response) return userOrResponse
    const user = userOrResponse

    const body = await request.json()
    const input = markReadSchema.parse(body)
    const notificationIds = input.notification_ids
    const markAll = input.mark_all

    const supabase = await createClient()

    if (markAll) {
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false)
      if (updateError) throw new Error(`Failed to mark all as read: ${updateError.message}`)
    } else if (notificationIds && notificationIds.length > 0) {
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .in('id', notificationIds)
      if (updateError) throw new Error(`Failed to mark notifications as read: ${updateError.message}`)
    }

    return success({ marked_read: true })
  } catch (err) {
    return handleApiError(err)
  }
}

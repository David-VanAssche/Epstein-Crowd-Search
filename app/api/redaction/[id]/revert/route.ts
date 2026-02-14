// app/api/redaction/[id]/revert/route.ts
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { success, error, handleApiError } from '@/lib/api/responses'
import { requireAdmin } from '@/lib/auth/middleware'

const revertSchema = z.object({
  reason: z.string().min(5, 'Please provide a reason for reverting').max(2000),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // Admin-only via tamper-proof app_metadata
    const userOrResponse = await requireAdmin()
    if (userOrResponse instanceof Response) return userOrResponse
    const admin = userOrResponse

    const { id: redactionId } = await params
    const body = await request.json()
    const input = revertSchema.parse(body)

    const supabase = await createClient()

    // Call the atomic revert function
    const { data, error: rpcError } = await supabase.rpc('revert_cascade_tree', {
      p_root_redaction_id: redactionId,
      p_admin_user_id: admin.id,
      p_reason: input.reason,
    })

    if (rpcError) {
      throw new Error(`Revert failed: ${rpcError.message}`)
    }

    const result = data as { reverted?: boolean; reason?: string } | null

    if (!result?.reverted) {
      return error(result?.reason || 'Revert failed', 400)
    }

    return success(result)
  } catch (err) {
    return handleApiError(err)
  }
}

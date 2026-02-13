// app/api/contradictions/[id]/verify/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { contradictionVoteSchema } from '@/lib/api/schemas'
import { success, unauthorized, notFound, error, handleApiError } from '@/lib/api/responses'

interface RouteParams {
  params: Promise<{ id: string }>
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    if (!UUID_RE.test(id)) return error('Invalid contradiction ID format')
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return unauthorized()

    const body = await request.json()
    const input = contradictionVoteSchema.parse(body)

    // Verify contradiction exists
    const { data: contradiction } = await supabase
      .from('contradictions')
      .select('id')
      .eq('id', id)
      .single()

    if (!contradiction) return notFound('Contradiction not found')

    // Upsert vote (replace existing vote)
    const { error: deleteError } = await supabase
      .from('contradiction_votes')
      .delete()
      .eq('contradiction_id', id)
      .eq('user_id', user.id)

    if (deleteError) throw new Error(`Delete vote failed: ${deleteError.message}`)

    const { data: vote, error: insertError } = await supabase
      .from('contradiction_votes')
      .insert({
        contradiction_id: id,
        user_id: user.id,
        vote_type: input.vote_type,
      })
      .select('id, vote_type')
      .single()

    if (insertError) throw new Error(`Vote failed: ${insertError.message}`)

    // Get updated counts
    const { data: updated } = await supabase
      .from('contradictions')
      .select('verify_count, dispute_count, is_verified')
      .eq('id', id)
      .single()

    return success({
      vote,
      contradiction: updated,
    })
  } catch (err) {
    return handleApiError(err)
  }
}

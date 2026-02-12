// app/api/chat/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { chatRequestSchema } from '@/lib/api/schemas'
import { handleApiError } from '@/lib/api/responses'
import { getUser } from '@/lib/auth/middleware'
import { checkRateLimit, getClientIP, RATE_LIMITS } from '@/lib/auth/rate-limit'

export async function POST(request: NextRequest) {
  try {
    // Parse and validate
    const body = await request.json()
    const input = chatRequestSchema.parse(body)

    // Rate limiting based on tier
    const user = await getUser()
    const identifier = user?.id || getClientIP(request)
    const rateConfig =
      input.model_tier === 'free' ? RATE_LIMITS.chat_free : RATE_LIMITS.chat_paid
    const rateLimitResponse = checkRateLimit(identifier, rateConfig)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    // Create or update conversation record
    let conversationId = input.conversation_id

    if (!conversationId) {
      const { data: conversation, error: convError } = await supabase
        .from('chat_conversations')
        .insert({
          user_id: user?.id || null,
          session_id: input.session_id,
          title: input.message.slice(0, 100),
          messages: [],
          model_tier: input.model_tier,
          message_count: 0,
        })
        .select('id')
        .single()

      if (convError) {
        throw new Error(`Failed to create conversation: ${convError.message}`)
      }
      conversationId = conversation.id
    }

    // For now, return a placeholder SSE stream.
    // Phase 5 (AI providers) will integrate real LLM responses.
    // This sets up the SSE infrastructure correctly.

    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        // Send initial event
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'text_delta', content: 'I am the Epstein Archive AI assistant. ' })}\n\n`
          )
        )

        // Simulate a response about the query
        const responseChunks = [
          'AI chat integration is not yet active. ',
          'Once Phase 5 (AI Providers) is complete, ',
          'I will be able to search across the corpus ',
          'and provide answers with full citations. ',
          'For now, you can use the search page to find documents.',
        ]

        for (const chunk of responseChunks) {
          await new Promise((resolve) => setTimeout(resolve, 50))
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'text_delta', content: chunk })}\n\n`
            )
          )
        }

        // Send done event
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'done', conversation_id: conversationId })}\n\n`
          )
        )

        controller.close()
      },
    })

    // Atomically append message to the JSONB array using Supabase RPC.
    // This avoids the read-modify-write race condition.
    const newMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.message,
      created_at: new Date().toISOString(),
    }

    await supabase.rpc('append_chat_message', {
      p_conversation_id: conversationId,
      p_message: newMessage,
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (err) {
    return handleApiError(err)
  }
}

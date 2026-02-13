// app/api/chat/route.ts
// Next.js App Router API route for POST /api/chat.
// SSE streaming with real LLM integration via ChatOrchestrator.
// Replaces the Phase 4 placeholder.

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ChatOrchestrator, type ChatMessage } from '@/lib/chat/chat-orchestrator'
import { chatRequestSchema } from '@/lib/api/schemas'
import { handleApiError } from '@/lib/api/responses'
import { getUser } from '@/lib/auth/middleware'
import { checkRateLimit, getClientIP, RATE_LIMITS } from '@/lib/auth/rate-limit'

export const runtime = 'nodejs' // Required for streaming
export const maxDuration = 60 // Allow up to 60s for tool-calling loops

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

    // Check if AI chat is available (API key configured)
    const apiKey = process.env.GOOGLE_AI_API_KEY
    if (!apiKey) {
      // Graceful fallback when AI is not configured
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        async start(controller) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'start' })}\n\n`)
          )
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'content',
                content: 'The AI chat service is not yet configured. Please set the GOOGLE_AI_API_KEY environment variable to enable real-time research assistance. In the meantime, you can use the search page to find documents.',
                citations: [],
              })}\n\n`
            )
          )
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'done', conversation_id: conversationId })}\n\n`)
          )
          controller.close()
        },
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      })
    }

    // Real AI chat with tool-calling orchestrator
    const adminSupabase = createAdminClient()
    const orchestrator = new ChatOrchestrator(
      adminSupabase,
      apiKey,
      parseInt(process.env.CHAT_MAX_TOOL_ITERATIONS || '5', 10)
    )

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'start' })}\n\n`)
          )

          // Build messages array for the orchestrator
          const messages: ChatMessage[] = [
            { role: 'user', content: input.message },
          ]

          const response = await orchestrator.chat(messages)

          // Stream tool usage events
          for (const tool of response.toolsUsed) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'tool_used', tool })}\n\n`)
            )
          }

          // Stream the content
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'content',
                content: response.content,
                citations: response.citations,
              })}\n\n`
            )
          )

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'done', conversation_id: conversationId })}\n\n`)
          )

          // Append messages to conversation
          const newMessage = {
            id: crypto.randomUUID(),
            role: 'user',
            content: input.message,
            created_at: new Date().toISOString(),
          }

          const { error: rpcError } = await supabase.rpc('append_chat_message', {
            p_conversation_id: conversationId,
            p_message: newMessage,
          })
          if (rpcError) {
            // RPC may not exist — silent fallback
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Unknown error'
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'error', error: errorMsg })}\n\n`)
          )
        } finally {
          controller.close()
        }
      },
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

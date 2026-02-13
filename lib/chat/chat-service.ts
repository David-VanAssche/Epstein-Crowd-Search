// lib/chat/chat-service.ts
import type { ChatStreamEvent, ChatRequest, Citation } from '@/types/chat'
import { parseSSEStream, fetchWithRetry } from './streaming'

export interface ChatServiceOptions {
  onTextDelta: (text: string) => void
  onCitation: (citation: Citation) => void
  onDone: (conversationId?: string) => void
  onError: (error: string) => void
}

/**
 * Send a chat message and handle the streaming response.
 */
export async function sendChatMessage(
  request: ChatRequest,
  options: ChatServiceOptions
): Promise<void> {
  try {
    const response = await fetchWithRetry('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null)
      options.onError(errorBody?.error || `Request failed with status ${response.status}`)
      return
    }

    for await (const event of parseSSEStream(response)) {
      switch (event.type) {
        case 'text_delta':
          if (event.content) {
            options.onTextDelta(event.content)
          }
          break
        case 'citation':
          if (event.citation) {
            options.onCitation(event.citation)
          }
          break
        case 'done':
          options.onDone(event.conversation_id)
          break
        case 'error':
          options.onError(event.error || 'Unknown streaming error')
          return
      }
    }
  } catch (err) {
    options.onError(err instanceof Error ? err.message : 'Chat request failed')
  }
}

/**
 * Generate a unique session ID for anonymous users.
 */
export function generateSessionId(): string {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('chat_session_id')
    if (stored) return stored

    const newId = crypto.randomUUID()
    localStorage.setItem('chat_session_id', newId)
    return newId
  }
  return crypto.randomUUID()
}

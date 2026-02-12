// lib/hooks/useChat.ts
'use client'

import { useState, useCallback, useRef } from 'react'
import { sendChatMessage, generateSessionId } from '@/lib/chat/chat-service'
import type { ChatMessage, Citation } from '@/types/chat'

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const sessionIdRef = useRef<string | null>(null)

  const getSessionId = useCallback(() => {
    if (!sessionIdRef.current) {
      sessionIdRef.current = generateSessionId()
    }
    return sessionIdRef.current
  }, [])

  const send = useCallback(async (content: string) => {
    if (!content.trim() || isStreaming) return

    setError(null)

    // Add user message
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    }

    // Add empty assistant message to stream into
    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      citations: [],
      created_at: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage, assistantMessage])
    setIsStreaming(true)

    await sendChatMessage(
      {
        message: content,
        conversation_id: conversationId ?? undefined,
        session_id: getSessionId(),
      },
      {
        onTextDelta: (text) => {
          setMessages((prev) => {
            const updated = [...prev]
            const last = updated[updated.length - 1]
            if (last.role === 'assistant') {
              updated[updated.length - 1] = { ...last, content: last.content + text }
            }
            return updated
          })
        },
        onCitation: (citation: Citation) => {
          setMessages((prev) => {
            const updated = [...prev]
            const last = updated[updated.length - 1]
            if (last.role === 'assistant') {
              updated[updated.length - 1] = {
                ...last,
                citations: [...(last.citations ?? []), citation],
              }
            }
            return updated
          })
        },
        onDone: (newConversationId?: string) => {
          if (newConversationId) setConversationId(newConversationId)
          setIsStreaming(false)
        },
        onError: (errorMsg) => {
          setError(errorMsg)
          setIsStreaming(false)
          // Remove the empty assistant message on error
          setMessages((prev) => {
            if (prev.length > 0 && prev[prev.length - 1].content === '') {
              return prev.slice(0, -1)
            }
            return prev
          })
        },
      }
    )
  }, [isStreaming, conversationId, getSessionId])

  const clearMessages = useCallback(() => {
    setMessages([])
    setConversationId(null)
    setError(null)
  }, [])

  return {
    messages,
    isStreaming,
    error,
    send,
    clearMessages,
  }
}

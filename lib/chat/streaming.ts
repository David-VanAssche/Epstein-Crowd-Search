// lib/chat/streaming.ts
import type { ChatStreamEvent } from '@/types/chat'

/**
 * Parse a Server-Sent Events stream from the chat API.
 * Returns an async generator that yields ChatStreamEvents.
 */
export async function* parseSSEStream(
  response: Response
): AsyncGenerator<ChatStreamEvent, void, unknown> {
  const reader = response.body?.getReader()
  if (!reader) return

  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')

      // Keep the last incomplete line in the buffer
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6).trim()
          if (jsonStr === '[DONE]') {
            yield { type: 'done' }
            return
          }
          try {
            const event: ChatStreamEvent = JSON.parse(jsonStr)
            yield event
          } catch {
            console.error('[SSE] Failed to parse event:', jsonStr)
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

/**
 * Reconnection wrapper for SSE streams.
 * Retries on network errors with exponential backoff.
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = 3
): Promise<Response> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options)

      if (!response.ok) {
        // Don't retry client errors (4xx) — only retry server/network errors
        if (response.status >= 400 && response.status < 500) {
          return response
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return response
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))

      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError || new Error('Failed after retries')
}

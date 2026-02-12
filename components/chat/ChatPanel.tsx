// components/chat/ChatPanel.tsx
'use client'

import { useRef, useEffect } from 'react'
import { X, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'
import { useChat } from '@/lib/hooks/useChat'

interface ChatPanelProps {
  open: boolean
  onClose: () => void
}

export function ChatPanel({ open, onClose }: ChatPanelProps) {
  const { messages, isStreaming, error, send, clearMessages } = useChat()
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  if (!open) return null

  return (
    <div className="fixed bottom-0 right-0 z-50 flex h-[min(600px,80vh)] w-full flex-col border-l border-t border-border bg-background shadow-2xl sm:bottom-4 sm:right-4 sm:w-[400px] sm:rounded-lg sm:border">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold">Ask the Archive</h3>
          <p className="text-xs text-muted-foreground">AI-powered search assistant</p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clearMessages}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="text-sm font-medium text-foreground mb-1">Welcome</p>
            <p className="text-xs text-muted-foreground max-w-[280px]">
              Ask questions about the Epstein files. I&apos;ll search the archive and cite
              specific documents in my answers.
            </p>
            <div className="mt-4 space-y-2">
              {[
                'Who traveled on the Lolita Express?',
                'What does the Palm Beach police report say?',
                'Summarize the Maxwell deposition',
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="block w-full rounded-md border border-border bg-surface px-3 py-2 text-left text-xs text-muted-foreground hover:bg-surface-elevated transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
          </div>
        )}
        {error && (
          <div className="mt-2 rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <ChatInput onSend={send} isStreaming={isStreaming} />
    </div>
  )
}

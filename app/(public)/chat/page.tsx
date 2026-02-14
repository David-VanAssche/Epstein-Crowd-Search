'use client'

import { useRef, useEffect } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChatMessage } from '@/components/chat/ChatMessage'
import { ChatInput } from '@/components/chat/ChatInput'
import { CitationCard } from '@/components/chat/CitationCard'
import { useChat } from '@/lib/hooks/useChat'

export default function ChatPage() {
  const { messages, isStreaming, error, send, clearMessages } = useChat()
  const scrollEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Collect all citations from assistant messages
  const allCitations = messages
    .filter((m) => m.role === 'assistant' && m.citations?.length)
    .flatMap((m) => m.citations ?? [])

  return (
    <div className="flex h-[calc(100vh-var(--topbar-height))]">
      {/* Chat column */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-3">
          <div>
            <h1 className="text-lg font-semibold">Ask the Archive</h1>
            <p className="text-sm text-muted-foreground">
              AI-powered search across the complete Epstein files
            </p>
          </div>
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={clearMessages}>
            <Trash2 className="h-4 w-4" />
            Clear
          </Button>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-6">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <h2 className="text-xl font-semibold mb-2">What would you like to investigate?</h2>
              <p className="text-sm text-muted-foreground max-w-md mb-8">
                Ask questions about the Epstein files. I&apos;ll search the archive and cite
                specific documents in my answers.
              </p>
              <div className="grid gap-3 sm:grid-cols-2 max-w-xl">
                {[
                  'Who traveled on the Lolita Express most frequently?',
                  'What does the Palm Beach police report say about the investigation?',
                  'Summarize the key points of the Maxwell deposition',
                  'What financial connections exist between Epstein and Deutsche Bank?',
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    className="rounded-lg border border-border bg-surface p-4 text-left text-sm text-muted-foreground hover:bg-surface-elevated hover:text-foreground transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} />
              ))}
              <div ref={scrollEndRef} />
            </div>
          )}
          {error && (
            <div className="mx-auto mt-4 max-w-3xl rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </ScrollArea>

        {/* Input */}
        <div className="mx-auto w-full max-w-3xl px-6">
          <ChatInput onSend={send} isStreaming={isStreaming} />
        </div>
      </div>

      {/* Citations sidebar - desktop only */}
      <aside className="hidden lg:flex w-80 flex-col border-l border-border bg-surface">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold">Citations</h3>
          <p className="text-xs text-muted-foreground">
            {allCitations.length} source{allCitations.length !== 1 ? 's' : ''} referenced
          </p>
        </div>
        <ScrollArea className="flex-1 p-4">
          {allCitations.length > 0 ? (
            <div className="space-y-2">
              {allCitations.map((citation, i) => (
                <CitationCard
                  key={`${citation.chunk_id}-${i}`}
                  citation={citation}
                  index={i}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Citations from the archive will appear here as you chat.
            </p>
          )}
        </ScrollArea>
      </aside>
    </div>
  )
}

// components/chat/ChatMessage.tsx
'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import { User, Bot } from 'lucide-react'
import { CitationCard } from './CitationCard'
import type { ChatMessage as ChatMessageType } from '@/types/chat'

interface ChatMessageProps {
  message: ChatMessageType
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
          isUser ? 'bg-primary/20' : 'bg-surface-elevated'
        }`}
      >
        {isUser ? (
          <User className="h-4 w-4 text-primary" />
        ) : (
          <Bot className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      <div className={`min-w-0 max-w-[85%] space-y-2 ${isUser ? 'text-right' : ''}`}>
        <div
          className={`rounded-lg px-3 py-2 text-sm ${
            isUser
              ? 'bg-primary text-primary-foreground'
              : 'bg-surface border border-border'
          }`}
        >
          {isUser ? (
            <p>{message.content}</p>
          ) : (
            <div className="prose prose-sm prose-invert max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeSanitize]}
                components={{
                  a: ({ href, children }) => (
                    <a href={href} target="_blank" rel="noopener noreferrer">
                      {children}
                    </a>
                  ),
                }}
              >
                {message.content || '...'}
              </ReactMarkdown>
            </div>
          )}
        </div>
        {message.citations && message.citations.length > 0 && (
          <div className="space-y-1">
            {message.citations.map((citation, i) => (
              <CitationCard key={`${citation.chunk_id}-${i}`} citation={citation} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

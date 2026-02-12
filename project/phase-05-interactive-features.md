# Phase 5: Interactive Features

> **Sessions:** 3 | **Dependencies:** Phase 3 (UI pages), Phase 4 (API routes) | **Parallel with:** Phase 7 (Funding)

## Summary

Build the interactive features that drive engagement and crowdsourced contribution: the global AI chat panel (RAG-powered Q&A about the documents), the redaction solving UI (proposal submission, voting, evidence linking), bookmarking and saved searches, user profile pages with contribution history, the notification system, and real-time updates via Supabase Realtime. These features transform the platform from a read-only archive into a collaborative research tool where every user's contribution moves the investigation forward.

## IMPORTANT: Dependencies

Phase 5 requires:
1. Phase 3 pages exist (document viewer, entity pages, search)
2. Phase 4 API routes exist (auth, search, document fetching)
3. Supabase auth is configured and working
4. Database tables from Phase 2 are live (redactions, proposals, users, notifications)

For any features that depend on backend services not yet ready (e.g., RAG pipeline, real-time subscriptions), use mock data and `enabled: false` React Query patterns — same approach as Phase 3.

---

## Step-by-Step Execution

### Step 1: Install additional dependencies

```bash
# Real-time subscriptions
pnpm add @supabase/realtime-js

# Markdown rendering for chat messages
pnpm add react-markdown remark-gfm

# Date formatting
pnpm add date-fns

# Additional shadcn/ui components needed
npx shadcn@latest add sheet
npx shadcn@latest add switch
npx shadcn@latest add radio-group
npx shadcn@latest add alert
npx shadcn@latest add dialog
npx shadcn@latest add collapsible
```

Answer "yes" to all shadcn prompts. All components go into `components/ui/`.

### Step 2: Create component directories

```bash
mkdir -p components/chat
mkdir -p components/redaction
mkdir -p components/contribute
mkdir -p components/annotations
mkdir -p components/investigations
mkdir -p components/notifications
mkdir -p components/profile
mkdir -p components/saved
```

### Step 3: Create TypeScript types for interactive features

File: `types/chat.ts`

```typescript
// types/chat.ts

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources: ChatSource[]
  created_at: string
}

export interface ChatSource {
  document_id: string
  document_filename: string
  chunk_id: string
  page_number: number | null
  snippet: string
  relevance_score: number
}

export interface ChatSession {
  id: string
  user_id: string | null
  messages: ChatMessage[]
  created_at: string
  updated_at: string
}

export interface ChatRateLimit {
  remaining: number
  limit: number
  resets_at: string
}

export type ChatTier = 'free' | 'premium' | 'researcher'
```

File: `types/redaction.ts`

```typescript
// types/redaction.ts

export type RedactionStatus = 'unsolved' | 'proposed' | 'corroborated' | 'confirmed' | 'disputed'

export type EvidenceType =
  | 'unredacted_document'
  | 'cross_reference'
  | 'public_record'
  | 'court_testimony'
  | 'media_report'
  | 'personal_knowledge'

export interface Redaction {
  id: string
  document_id: string
  document_filename: string
  dataset_name: string | null
  page_number: number | null
  surrounding_text: string
  redaction_type: string | null
  estimated_length: number | null
  status: RedactionStatus
  proposal_count: number
  potential_cascade_count: number
  xp_reward: number
  nearby_entities: string[]
  created_at: string
}

export interface RedactionProposal {
  id: string
  redaction_id: string
  user_id: string
  user_display_name: string
  proposed_text: string
  evidence_type: EvidenceType
  evidence_description: string
  source_urls: string[]
  supporting_document_ids: string[]
  confidence_score: number
  upvotes: number
  downvotes: number
  corroborations: number
  status: 'pending' | 'accepted' | 'rejected'
  created_at: string
}

export interface RedactionStats {
  total: number
  solved: number
  proposed: number
  unsolved: number
}
```

File: `types/notifications.ts`

```typescript
// types/notifications.ts

export type NotificationType =
  | 'proposal_update'
  | 'annotation_reply'
  | 'search_alert'
  | 'achievement'
  | 'bounty_update'
  | 'investigation_update'
  | 'system'

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  body: string
  link: string | null
  is_read: boolean
  created_at: string
  metadata: Record<string, unknown>
}

export interface NotificationPreferences {
  proposal_updates: boolean
  annotation_replies: boolean
  search_alerts: boolean
  achievements: boolean
  bounty_updates: boolean
  investigation_updates: boolean
  email_digest: 'none' | 'daily' | 'weekly'
}
```

File: `types/profile.ts`

```typescript
// types/profile.ts

export type ReputationTier = 'newcomer' | 'contributor' | 'researcher' | 'expert' | 'authority'

export interface UserProfile {
  id: string
  display_name: string
  avatar_url: string | null
  bio: string | null
  reputation_tier: ReputationTier
  accuracy_rate: number
  xp: number
  level: number
  proposals_submitted: number
  proposals_confirmed: number
  cascades_triggered: number
  annotations_count: number
  investigations_count: number
  joined_at: string
}

export interface ContributionHistoryItem {
  id: string
  type: 'proposal' | 'annotation' | 'investigation' | 'ocr_correction' | 'photo_id'
  title: string
  description: string
  xp_earned: number
  created_at: string
  link: string
}

export interface Bookmark {
  id: string
  user_id: string
  target_type: 'document' | 'entity' | 'chunk' | 'redaction'
  target_id: string
  target_title: string
  notes: string | null
  created_at: string
}

export interface SavedSearch {
  id: string
  user_id: string
  query: string
  filters: Record<string, unknown>
  alert_enabled: boolean
  alert_frequency: 'immediate' | 'daily' | 'weekly' | null
  last_run_at: string | null
  new_results_count: number
  created_at: string
}
```

### Step 4: Build the AI Chat Panel — Session 1

The chat panel is a global feature rendered in the root layout. It appears as a floating action button (FAB) in the bottom-right corner of every page.

#### `lib/hooks/useChat.ts`

```typescript
// lib/hooks/useChat.ts
'use client'

import { useState, useCallback, useRef } from 'react'
import type { ChatMessage, ChatSource, ChatRateLimit, ChatTier } from '@/types/chat'

interface UseChatOptions {
  tier?: ChatTier
}

export function useChat({ tier = 'free' }: UseChatOptions = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rateLimit, setRateLimit] = useState<ChatRateLimit>({
    remaining: tier === 'free' ? 20 : 200,
    limit: tier === 'free' ? 20 : 200,
    resets_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  })
  const [sessionId] = useState(() => crypto.randomUUID())
  const abortControllerRef = useRef<AbortController | null>(null)

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isStreaming) return
      if (rateLimit.remaining <= 0) {
        setError('Rate limit reached. Upgrade to Premium for more questions.')
        return
      }

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: content.trim(),
        sources: [],
        created_at: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, userMessage])
      setInput('')
      setIsStreaming(true)
      setError(null)

      // Placeholder assistant message for streaming
      const assistantId = crypto.randomUUID()
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        sources: [],
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, assistantMessage])

      try {
        abortControllerRef.current = new AbortController()

        // Will call /api/chat in Phase 6 with SSE streaming.
        // For now, simulate a response after a short delay.
        await new Promise((resolve) => setTimeout(resolve, 1500))

        const mockResponse =
          'I found several relevant documents in the archive. This feature will be connected to the RAG pipeline in Phase 6, enabling AI-powered search across the full corpus with source citations.'
        const mockSources: ChatSource[] = [
          {
            document_id: 'mock-doc-1',
            document_filename: 'DOJ-Release-001.pdf',
            chunk_id: 'mock-chunk-1',
            page_number: 12,
            snippet: 'Sample source text from the document...',
            relevance_score: 0.92,
          },
        ]

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId
              ? { ...msg, content: mockResponse, sources: mockSources }
              : msg
          )
        )

        setRateLimit((prev) => ({ ...prev, remaining: prev.remaining - 1 }))
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
        setError('Failed to get a response. Please try again.')
        setMessages((prev) => prev.filter((msg) => msg.id !== assistantId))
      } finally {
        setIsStreaming(false)
        abortControllerRef.current = null
      }
    },
    [isStreaming, rateLimit.remaining]
  )

  const stopStreaming = useCallback(() => {
    abortControllerRef.current?.abort()
    setIsStreaming(false)
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  return {
    messages,
    input,
    setInput,
    isStreaming,
    error,
    rateLimit,
    sessionId,
    sendMessage,
    stopStreaming,
    clearMessages,
  }
}
```

#### `components/chat/ChatFAB.tsx`

```tsx
// components/chat/ChatFAB.tsx
'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ChatPanel } from './ChatPanel'

export function ChatFAB() {
  const [isOpen, setIsOpen] = useState(false)
  const [hasPulsed, setHasPulsed] = useState(false)

  useEffect(() => {
    // Stop pulse animation after first open
    if (isOpen) setHasPulsed(true)
  }, [isOpen])

  return (
    <>
      {/* Floating Action Button */}
      <Button
        onClick={() => setIsOpen((prev) => !prev)}
        className={`fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full shadow-lg transition-all hover:scale-105 ${
          isOpen ? 'bg-muted text-muted-foreground' : 'bg-accent text-accent-foreground'
        }`}
        aria-label={isOpen ? 'Close chat' : 'Ask the Archive'}
        title="Ask the Archive"
      >
        {isOpen ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
        {/* Pulse animation ring */}
        {!hasPulsed && !isOpen && (
          <span className="absolute inset-0 animate-ping rounded-full bg-accent opacity-30" />
        )}
      </Button>

      {/* Chat Panel */}
      <ChatPanel isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  )
}
```

#### `components/chat/ChatPanel.tsx`

```tsx
// components/chat/ChatPanel.tsx
'use client'

import { useRef, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'
import { useChat } from '@/lib/hooks/useChat'

interface ChatPanelProps {
  isOpen: boolean
  onClose: () => void
}

export function ChatPanel({ isOpen, onClose }: ChatPanelProps) {
  const {
    messages,
    input,
    setInput,
    isStreaming,
    error,
    rateLimit,
    sendMessage,
    stopStreaming,
    clearMessages,
  } = useChat()

  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  if (!isOpen) return null

  return (
    <div className="fixed bottom-24 right-6 z-50 flex h-[600px] w-[400px] flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Ask the Archive</h2>
          <Badge variant="outline" className="text-xs">AI</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={clearMessages} title="Clear chat">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
            </svg>
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose} title="Close">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <h3 className="mb-2 text-sm font-semibold">Ask the Archive</h3>
            <p className="max-w-[280px] text-xs text-muted-foreground">
              Ask questions about the Epstein files. I can search across 3.5 million
              pages and cite my sources.
            </p>
            <div className="mt-4 space-y-2">
              {[
                'Who flew on the Lolita Express?',
                'What do the Palm Beach police reports say?',
                'What financial connections exist?',
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => sendMessage(suggestion)}
                  className="block w-full rounded-lg border border-border px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-surface-elevated"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                isStreaming={
                  isStreaming &&
                  message === messages[messages.length - 1] &&
                  message.role === 'assistant'
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="border-t border-red-600/30 bg-red-950/20 px-4 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Rate Limit */}
      <div className="border-t border-border px-4 py-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{rateLimit.remaining}/{rateLimit.limit} questions remaining today</span>
          {rateLimit.remaining <= 5 && (
            <a href="/pricing" className="text-accent hover:underline">Upgrade</a>
          )}
        </div>
      </div>

      {/* Input */}
      <ChatInput
        value={input}
        onChange={setInput}
        onSend={sendMessage}
        onStop={stopStreaming}
        isStreaming={isStreaming}
        isDisabled={rateLimit.remaining <= 0}
      />
    </div>
  )
}
```

#### `components/chat/ChatMessage.tsx`

```tsx
// components/chat/ChatMessage.tsx
'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { SourceCitation } from './SourceCitation'
import type { ChatMessage as ChatMessageType } from '@/types/chat'

interface ChatMessageProps {
  message: ChatMessageType
  isStreaming?: boolean
}

export function ChatMessage({ message, isStreaming = false }: ChatMessageProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 ${
          isUser
            ? 'bg-accent text-accent-foreground'
            : 'bg-surface text-primary'
        }`}
      >
        {isUser ? (
          <p className="text-sm">{message.content}</p>
        ) : (
          <>
            {message.content ? (
              <div className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {message.content}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="flex items-center gap-1 py-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
              </div>
            )}
            {message.sources.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {message.sources.map((source) => (
                  <SourceCitation key={source.chunk_id} source={source} />
                ))}
              </div>
            )}
          </>
        )}
        <div className="mt-1 text-right">
          <time className="text-[10px] opacity-50">
            {new Date(message.created_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </time>
        </div>
      </div>
    </div>
  )
}
```

#### `components/chat/ChatInput.tsx`

```tsx
// components/chat/ChatInput.tsx
'use client'

import { useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'

interface ChatInputProps {
  value: string
  onChange: (value: string) => void
  onSend: (message: string) => void
  onStop: () => void
  isStreaming: boolean
  isDisabled: boolean
}

export function ChatInput({ value, onChange, onSend, onStop, isStreaming, isDisabled }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 96)}px`
    }
  }, [value])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (value.trim() && !isDisabled && !isStreaming) {
        onSend(value)
      }
    }
  }

  return (
    <div className="border-t border-border p-3">
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isDisabled ? 'Rate limit reached' : 'Ask about the Epstein files...'}
          disabled={isDisabled}
          rows={1}
          className="flex-1 resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50"
        />
        {isStreaming ? (
          <Button size="sm" variant="outline" onClick={onStop} title="Stop generating">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() => onSend(value)}
            disabled={!value.trim() || isDisabled}
            title="Send message"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </Button>
        )}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>Shift+Enter for new line</span>
        <span>{value.length}/2000</span>
      </div>
    </div>
  )
}
```

#### `components/chat/SourceCitation.tsx`

```tsx
// components/chat/SourceCitation.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { ChatSource } from '@/types/chat'

interface SourceCitationProps {
  source: ChatSource
}

export function SourceCitation({ source }: SourceCitationProps) {
  const [showPreview, setShowPreview] = useState(false)

  const href = `/document/${source.document_id}${source.page_number ? `#page-${source.page_number}` : ''}`
  const label = `${source.document_filename}${source.page_number ? `, p.${source.page_number}` : ''}`

  return (
    <div className="relative inline-block">
      <Link
        href={href}
        className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-elevated px-2 py-0.5 text-[10px] text-accent transition-colors hover:bg-accent/10"
        onMouseEnter={() => setShowPreview(true)}
        onMouseLeave={() => setShowPreview(false)}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        {label}
      </Link>
      {showPreview && (
        <div className="absolute bottom-full left-0 z-60 mb-1 w-64 rounded-lg border border-border bg-surface p-3 shadow-xl">
          <p className="mb-1 text-xs font-medium text-primary">{source.document_filename}</p>
          {source.page_number && (
            <p className="mb-1 text-[10px] text-muted-foreground">Page {source.page_number}</p>
          )}
          <p className="line-clamp-4 text-[10px] text-muted-foreground">{source.snippet}</p>
        </div>
      )}
    </div>
  )
}
```

#### Add ChatFAB to root layout

Update `app/layout.tsx` to include the ChatFAB. Add the import and render it just before the closing `</body>` tag:

```tsx
// In app/layout.tsx — add this import at the top:
import { ChatFAB } from '@/components/chat/ChatFAB'

// And render it inside the body, after the main content area:
// <main>{children}</main>
// <ChatFAB />   <-- Add this line
```

The ChatFAB + ChatPanel are rendered in the root layout so they persist across page navigations. The chat state (messages, input) lives in the `useChat` hook and survives route changes because the root layout is never unmounted.

### Step 5: Build the Redaction Solving UI — Session 1

#### `lib/hooks/useRedaction.ts`

```typescript
// lib/hooks/useRedaction.ts
'use client'

import { useState, useCallback } from 'react'
import type { Redaction, RedactionProposal, RedactionStats, EvidenceType } from '@/types/redaction'

export function useRedaction() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Will connect to /api/redactions in Phase 6
  const stats: RedactionStats = { total: 0, solved: 0, proposed: 0, unsolved: 0 }
  const redactions: Redaction[] = []
  const proposals: RedactionProposal[] = []

  const fetchSolvableFeed = useCallback(
    async (filters?: { dataset?: string; type?: string; sort?: string }) => {
      setIsLoading(true)
      try {
        // Will call /api/redactions/solvable?sort=cascade_potential&dataset=...
        return [] as Redaction[]
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  const submitProposal = useCallback(
    async (data: {
      redaction_id: string
      proposed_text: string
      evidence_type: EvidenceType
      evidence_description: string
      source_urls: string[]
      supporting_document_ids: string[]
    }) => {
      setIsLoading(true)
      setError(null)
      try {
        // Will POST to /api/redactions/[id]/proposals
        console.log('Submitting proposal:', data)
        return { success: true }
      } catch (err) {
        setError('Failed to submit proposal. Please try again.')
        return { success: false }
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  const voteOnProposal = useCallback(
    async (proposalId: string, vote: 'upvote' | 'downvote' | 'corroborate') => {
      try {
        // Will POST to /api/proposals/[id]/vote
        console.log('Voting:', proposalId, vote)
      } catch (err) {
        setError('Failed to submit vote.')
      }
    },
    []
  )

  return {
    stats,
    redactions,
    proposals,
    isLoading,
    error,
    fetchSolvableFeed,
    submitProposal,
    voteOnProposal,
  }
}
```

#### `app/(public)/redactions/page.tsx`

```tsx
// app/(public)/redactions/page.tsx
'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { SolvableFeed } from '@/components/redaction/SolvableFeed'
import { DailyChallenge } from '@/components/engagement/DailyChallenge'
import { EmptyState } from '@/components/shared/EmptyState'
import { useRedaction } from '@/lib/hooks/useRedaction'

export default function RedactionsPage() {
  const { stats } = useRedaction()
  const [tab, setTab] = useState('unsolved')

  const solvedPercent = stats.total > 0 ? Math.round((stats.solved / stats.total) * 100) : 0

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Redaction Puzzles</h1>
          <p className="mt-1 text-muted-foreground">
            Help uncover what the government blacked out. Every redaction you solve
            can cascade to unlock dozens more.
          </p>
        </div>
        <Link href="/contribute">
          <Button size="lg">I Know Something</Button>
        </Link>
      </div>

      {/* Global Progress */}
      <Card className="mb-8 border-border bg-surface">
        <CardContent className="pt-6">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium">Community Progress</span>
            <span className="text-sm text-muted-foreground">
              {stats.solved.toLocaleString()} / {stats.total.toLocaleString()} solved ({solvedPercent}%)
            </span>
          </div>
          <Progress value={solvedPercent} className="h-3" />
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-4">
        {[
          { label: 'Total Redactions', value: stats.total, color: 'text-primary' },
          { label: 'Solved', value: stats.solved, color: 'text-green-400' },
          { label: 'Proposals Pending', value: stats.proposed, color: 'text-amber-400' },
          { label: 'Unsolved', value: stats.unsolved, color: 'text-red-400' },
        ].map(({ label, value, color }) => (
          <Card key={label} className="border-border bg-surface">
            <CardContent className="pt-4 text-center">
              <div className={`text-2xl font-bold ${color}`}>{value.toLocaleString()}</div>
              <div className="mt-1 text-xs text-muted-foreground">{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Daily Challenge */}
      <div className="mb-8">
        <DailyChallenge />
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="unsolved">Most Impactful Unsolved</TabsTrigger>
          <TabsTrigger value="recent">Recently Solved</TabsTrigger>
          <TabsTrigger value="mine">My Proposals</TabsTrigger>
        </TabsList>

        <TabsContent value="unsolved" className="mt-6">
          <SolvableFeed />
        </TabsContent>

        <TabsContent value="recent" className="mt-6">
          <EmptyState
            variant="not-processed"
            title="Recently Solved Redactions"
            description="Confirmed redaction solves will appear here as the community contributes."
          />
        </TabsContent>

        <TabsContent value="mine" className="mt-6">
          <EmptyState
            variant="not-processed"
            title="Your Proposals"
            description="Sign in to see your submitted redaction proposals and their status."
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

#### `components/redaction/RedactionCard.tsx`

```tsx
// components/redaction/RedactionCard.tsx
'use client'

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Redaction } from '@/types/redaction'

interface RedactionCardProps {
  redaction: Redaction
}

const STATUS_COLORS: Record<string, string> = {
  unsolved: 'bg-red-500/10 text-red-400 border-red-500/30',
  proposed: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  corroborated: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  confirmed: 'bg-green-500/10 text-green-400 border-green-500/30',
  disputed: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
}

export function RedactionCard({ redaction }: RedactionCardProps) {
  const surroundingParts = redaction.surrounding_text.split('[REDACTED]')

  return (
    <Card className="border-border bg-surface transition-colors hover:bg-surface-elevated">
      <CardContent className="pt-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={STATUS_COLORS[redaction.status]}>
              {redaction.status}
            </Badge>
            {redaction.dataset_name && (
              <Badge variant="secondary" className="text-xs">{redaction.dataset_name}</Badge>
            )}
            {redaction.page_number && (
              <span className="text-xs text-muted-foreground">p.{redaction.page_number}</span>
            )}
          </div>
          <span className="text-xs text-muted-foreground">{redaction.proposal_count} proposals</span>
        </div>

        {/* Surrounding text with redaction block */}
        <div className="mb-3 rounded-lg bg-[#1e1e2e] p-3 font-mono text-sm leading-relaxed">
          {surroundingParts[0]}
          <span className="inline-block border border-dashed border-red-600 bg-black px-2">
            {'█'.repeat(redaction.estimated_length || 8)}
          </span>
          {surroundingParts[1] || ''}
        </div>

        {/* Meta info */}
        <div className="mb-3 flex flex-wrap gap-2">
          {redaction.redaction_type && (
            <span className="text-xs text-muted-foreground">Type: {redaction.redaction_type}</span>
          )}
          {redaction.estimated_length && (
            <span className="text-xs text-muted-foreground">Est. length: ~{redaction.estimated_length} chars</span>
          )}
          {redaction.potential_cascade_count > 0 && (
            <Badge variant="outline" className="border-accent/30 text-xs text-accent">
              Cascade: {redaction.potential_cascade_count} matches
            </Badge>
          )}
        </div>

        {/* Nearby entities */}
        {redaction.nearby_entities.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1">
            <span className="text-xs text-muted-foreground">Nearby:</span>
            {redaction.nearby_entities.map((entity) => (
              <Badge key={entity} variant="secondary" className="text-xs">{entity}</Badge>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-accent">+{redaction.xp_reward} XP</span>
          <div className="flex gap-2">
            <Link href={`/document/${redaction.document_id}${redaction.page_number ? `#page-${redaction.page_number}` : ''}`}>
              <Button variant="outline" size="sm">View Document</Button>
            </Link>
            <Link href={`/contribute/unredact?redaction_id=${redaction.id}`}>
              <Button size="sm">I Know What This Says</Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
```

#### `components/redaction/SolvableFeed.tsx`

```tsx
// components/redaction/SolvableFeed.tsx
'use client'

import { useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RedactionCard } from './RedactionCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { useRedaction } from '@/lib/hooks/useRedaction'
import type { Redaction } from '@/types/redaction'

export function SolvableFeed() {
  const { redactions, isLoading } = useRedaction()
  const [sortBy, setSortBy] = useState('cascade')
  const [datasetFilter, setDatasetFilter] = useState('all')

  const filteredRedactions: Redaction[] = redactions

  return (
    <div>
      <div className="mb-4 flex gap-3">
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Sort by..." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="cascade">Highest Cascade Potential</SelectItem>
            <SelectItem value="reward">Highest XP Reward</SelectItem>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="proposals">Most Proposals</SelectItem>
          </SelectContent>
        </Select>
        <Select value={datasetFilter} onValueChange={setDatasetFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Dataset..." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Datasets</SelectItem>
            {Array.from({ length: 12 }, (_, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>Dataset {i + 1}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filteredRedactions.length > 0 ? (
        <div className="space-y-4">
          {filteredRedactions.map((redaction) => (
            <RedactionCard key={redaction.id} redaction={redaction} />
          ))}
        </div>
      ) : (
        <EmptyState
          variant="not-processed"
          title="No Solvable Redactions Yet"
          description="Redactions will appear here as documents are processed. Each redaction is a puzzle waiting to be solved — the surrounding context and nearby entities provide clues."
          showFundingCTA
        />
      )}
    </div>
  )
}
```

#### `components/redaction/ProposalForm.tsx`

```tsx
// components/redaction/ProposalForm.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useRedaction } from '@/lib/hooks/useRedaction'
import type { EvidenceType } from '@/types/redaction'

interface ProposalFormProps {
  redactionId: string
  estimatedLength?: number | null
  surroundingText?: string
}

const EVIDENCE_TYPES: { value: EvidenceType; label: string; description: string }[] = [
  { value: 'unredacted_document', label: 'Unredacted Document', description: 'I have a version without the redaction' },
  { value: 'cross_reference', label: 'Cross-Reference', description: 'Another document in the archive reveals this' },
  { value: 'public_record', label: 'Public Record', description: 'Available in a public record (court filing, FOIA, etc.)' },
  { value: 'court_testimony', label: 'Court Testimony', description: 'Revealed in sworn testimony or depositions' },
  { value: 'media_report', label: 'Media Report', description: 'A credible media outlet has reported this' },
  { value: 'personal_knowledge', label: 'Personal Knowledge', description: 'I have direct knowledge of this information' },
]

export function ProposalForm({ redactionId, estimatedLength, surroundingText }: ProposalFormProps) {
  const { submitProposal, isLoading } = useRedaction()
  const [proposedText, setProposedText] = useState('')
  const [evidenceType, setEvidenceType] = useState<EvidenceType | ''>('')
  const [evidenceDescription, setEvidenceDescription] = useState('')
  const [sourceUrls, setSourceUrls] = useState('')
  const [supportingDocSearch, setSupportingDocSearch] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const lengthMismatch =
    estimatedLength && Math.abs(proposedText.length - estimatedLength) > estimatedLength * 0.3

  const canSubmit =
    proposedText.trim().length > 0 && evidenceType !== '' && evidenceDescription.trim().length > 0

  const handleSubmit = async () => {
    if (!canSubmit) return
    const result = await submitProposal({
      redaction_id: redactionId,
      proposed_text: proposedText,
      evidence_type: evidenceType as EvidenceType,
      evidence_description: evidenceDescription,
      source_urls: sourceUrls.split('\n').map((u) => u.trim()).filter(Boolean),
      supporting_document_ids: [],
    })
    if (result.success) setSubmitted(true)
  }

  if (submitted) {
    return (
      <Card className="border-green-500/30 bg-green-950/10">
        <CardContent className="pt-6 text-center">
          <h3 className="mb-2 text-lg font-semibold text-green-400">Proposal Submitted</h3>
          <p className="text-sm text-muted-foreground">
            Your proposal is now pending community review. You will be notified when it receives votes.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border bg-surface">
      <CardHeader>
        <CardTitle className="text-lg">Submit Redaction Proposal</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {surroundingText && (
          <div className="rounded-lg bg-[#1e1e2e] p-3 font-mono text-sm text-muted-foreground">
            {surroundingText}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="proposed-text">What does the redacted text say?</Label>
          <Input
            id="proposed-text"
            value={proposedText}
            onChange={(e) => setProposedText(e.target.value)}
            placeholder="Enter the redacted text..."
            className="font-mono"
          />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{proposedText.length} characters</span>
            {estimatedLength && <><span>|</span><span>Estimated: ~{estimatedLength} characters</span></>}
          </div>
          {lengthMismatch && (
            <p className="text-xs text-amber-400">
              Warning: Your text length differs significantly from the estimated redaction length.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label>How do you know this?</Label>
          <Select value={evidenceType} onValueChange={(v) => setEvidenceType(v as EvidenceType)}>
            <SelectTrigger><SelectValue placeholder="Select evidence type..." /></SelectTrigger>
            <SelectContent>
              {EVIDENCE_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="evidence-desc">Describe your evidence</Label>
          <Textarea
            id="evidence-desc"
            value={evidenceDescription}
            onChange={(e) => setEvidenceDescription(e.target.value)}
            placeholder="Explain how you determined the redacted text. Be specific."
            rows={4}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="source-urls">Source URLs (one per line, optional)</Label>
          <Textarea
            id="source-urls"
            value={sourceUrls}
            onChange={(e) => setSourceUrls(e.target.value)}
            placeholder={"https://example.com/evidence\nhttps://courtrecords.example.com/filing"}
            rows={3}
            className="font-mono text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="supporting-docs">Search archive for supporting documents (optional)</Label>
          <Input
            id="supporting-docs"
            value={supportingDocSearch}
            onChange={(e) => setSupportingDocSearch(e.target.value)}
            placeholder="Search documents in this archive..."
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <Badge variant="outline" className="text-accent">Earn ~50-200 XP if confirmed</Badge>
          <Button onClick={handleSubmit} disabled={!canSubmit || isLoading}>
            {isLoading ? 'Submitting...' : 'Submit Proposal'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
```

#### `components/redaction/ProposalVoting.tsx`

```tsx
// components/redaction/ProposalVoting.tsx
'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useRedaction } from '@/lib/hooks/useRedaction'
import type { RedactionProposal } from '@/types/redaction'

interface ProposalVotingProps {
  proposal: RedactionProposal
}

export function ProposalVoting({ proposal }: ProposalVotingProps) {
  const { voteOnProposal } = useRedaction()
  const [userVote, setUserVote] = useState<'upvote' | 'downvote' | 'corroborate' | null>(null)

  const totalVotes = proposal.upvotes + proposal.downvotes
  const confidencePercent = totalVotes > 0 ? Math.round((proposal.upvotes / totalVotes) * 100) : 0

  const handleVote = (type: 'upvote' | 'downvote' | 'corroborate') => {
    if (userVote === type) return
    setUserVote(type)
    voteOnProposal(proposal.id, type)
  }

  return (
    <Card className="border-border bg-surface">
      <CardContent className="pt-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-sm font-medium">@{proposal.user_display_name}</span>
          <Badge variant="outline" className="text-xs">{proposal.evidence_type.replace(/_/g, ' ')}</Badge>
          <span className="text-xs text-muted-foreground">
            {new Date(proposal.created_at).toLocaleDateString()}
          </span>
        </div>

        <div className="mb-3 rounded-lg border border-green-500/30 bg-green-950/10 p-3 font-mono text-sm">
          {proposal.proposed_text}
        </div>

        <p className="mb-3 text-sm text-muted-foreground">{proposal.evidence_description}</p>

        {proposal.source_urls.length > 0 && (
          <div className="mb-3">
            <span className="text-xs text-muted-foreground">Sources:</span>
            <div className="mt-1 space-y-1">
              {proposal.source_urls.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                  className="block truncate text-xs text-accent hover:underline">{url}</a>
              ))}
            </div>
          </div>
        )}

        <div className="mb-3">
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>Community Confidence</span><span>{confidencePercent}%</span>
          </div>
          <Progress value={confidencePercent} className="h-2" />
        </div>

        <div className="flex items-center gap-3">
          <Button variant={userVote === 'upvote' ? 'default' : 'outline'} size="sm" onClick={() => handleVote('upvote')}>
            Agree ({proposal.upvotes + (userVote === 'upvote' ? 1 : 0)})
          </Button>
          <Button variant={userVote === 'downvote' ? 'default' : 'outline'} size="sm" onClick={() => handleVote('downvote')}>
            Disagree ({proposal.downvotes + (userVote === 'downvote' ? 1 : 0)})
          </Button>
          <Button
            variant={userVote === 'corroborate' ? 'default' : 'outline'}
            size="sm"
            className={userVote === 'corroborate' ? 'bg-green-600 hover:bg-green-700' : ''}
            onClick={() => handleVote('corroborate')}
          >
            I Can Corroborate ({proposal.corroborations + (userVote === 'corroborate' ? 1 : 0)})
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
```

#### `components/redaction/CascadeTree.tsx`

```tsx
// components/redaction/CascadeTree.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface CascadeTreeProps {
  redactionId: string
  cascadeCount: number
}

export function CascadeTree({ redactionId, cascadeCount }: CascadeTreeProps) {
  // Full D3-based cascade visualization will be added in Phase 8.
  return (
    <Card className="border-border bg-surface">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Cascade Chain</CardTitle>
      </CardHeader>
      <CardContent>
        {cascadeCount > 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Solving this redaction could cascade to unlock{' '}
              <span className="font-semibold text-accent">{cascadeCount}</span> additional redactions.
            </p>
            <div className="rounded-lg bg-[#1e1e2e] p-4 font-mono text-xs text-muted-foreground">
              <div className="text-accent">This Redaction</div>
              <div className="ml-2 border-l border-border pl-2">
                <div className="mt-1">Cascade Match 1 (Dataset 3, p.45)</div>
                <div className="mt-1">Cascade Match 2 (Dataset 7, p.12)</div>
                {cascadeCount > 2 && (
                  <div className="mt-1 text-muted-foreground">...and {cascadeCount - 2} more</div>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Interactive cascade visualization coming in Phase 8.</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No cascade matches detected for this redaction.</p>
        )}
      </CardContent>
    </Card>
  )
}
```

#### `components/redaction/UserReputation.tsx`

```tsx
// components/redaction/UserReputation.tsx
import { Badge } from '@/components/ui/badge'
import type { ReputationTier } from '@/types/profile'

interface UserReputationProps {
  tier: ReputationTier
  accuracyRate: number
  proposalCount: number
}

const TIER_CONFIG: Record<ReputationTier, { label: string; color: string }> = {
  newcomer: { label: 'Newcomer', color: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30' },
  contributor: { label: 'Contributor', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  researcher: { label: 'Researcher', color: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
  expert: { label: 'Expert', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  authority: { label: 'Authority', color: 'bg-green-500/10 text-green-400 border-green-500/30' },
}

export function UserReputation({ tier, accuracyRate, proposalCount }: UserReputationProps) {
  const config = TIER_CONFIG[tier]
  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className={config.color}>{config.label}</Badge>
      <span className="text-xs text-muted-foreground">{Math.round(accuracyRate * 100)}% accuracy</span>
      <span className="text-xs text-muted-foreground">{proposalCount} proposals</span>
    </div>
  )
}
```

#### `components/engagement/DailyChallenge.tsx`

```tsx
// components/engagement/DailyChallenge.tsx
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export function DailyChallenge() {
  const [timeRemaining, setTimeRemaining] = useState('')

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date()
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(0, 0, 0, 0)
      const diff = tomorrow.getTime() - now.getTime()
      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      setTimeRemaining(`${hours}h ${minutes}m`)
    }
    updateTimer()
    const interval = setInterval(updateTimer, 60000)
    return () => clearInterval(interval)
  }, [])

  // Will fetch from /api/redactions/daily-challenge in Phase 6
  const challenge = null as null | {
    id: string
    surrounding_text: string
    estimated_length: number
    potential_cascade_count: number
    xp_reward: number
    attempts_today: number
  }

  return (
    <Card className="border-accent/30 bg-accent/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg text-accent">Daily Challenge</CardTitle>
          <Badge variant="outline" className="text-xs">Next in {timeRemaining}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {challenge ? (
          <div>
            <div className="mb-3 rounded-lg bg-[#1e1e2e] p-3 font-mono text-sm">
              {challenge.surrounding_text.replace('[REDACTED]', '█'.repeat(challenge.estimated_length || 8))}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{challenge.attempts_today} attempted today</span>
                <span>Cascade: {challenge.potential_cascade_count} matches</span>
                <Badge variant="outline" className="text-accent">+{challenge.xp_reward} XP bonus</Badge>
              </div>
              <Link href={`/contribute/unredact?redaction_id=${challenge.id}`}>
                <Button size="sm">Attempt Challenge</Button>
              </Link>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            The daily challenge will appear here once redactions are cataloged from processed documents.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
```

### Step 6: Build Bookmarking and Saved Searches — Session 2

#### `lib/hooks/useBookmarks.ts`

```typescript
// lib/hooks/useBookmarks.ts
'use client'

import { useState, useCallback } from 'react'
import type { Bookmark, SavedSearch } from '@/types/profile'

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const addBookmark = useCallback(
    async (data: {
      target_type: Bookmark['target_type']
      target_id: string
      target_title: string
      notes?: string
    }) => {
      // Will POST to /api/bookmarks in Phase 6
      const newBookmark: Bookmark = {
        id: crypto.randomUUID(),
        user_id: 'current-user',
        target_type: data.target_type,
        target_id: data.target_id,
        target_title: data.target_title,
        notes: data.notes || null,
        created_at: new Date().toISOString(),
      }
      setBookmarks((prev) => [newBookmark, ...prev])
    },
    []
  )

  const removeBookmark = useCallback(async (bookmarkId: string) => {
    setBookmarks((prev) => prev.filter((b) => b.id !== bookmarkId))
  }, [])

  const saveSearch = useCallback(
    async (data: { query: string; filters: Record<string, unknown> }) => {
      const newSearch: SavedSearch = {
        id: crypto.randomUUID(),
        user_id: 'current-user',
        query: data.query,
        filters: data.filters,
        alert_enabled: false,
        alert_frequency: null,
        last_run_at: null,
        new_results_count: 0,
        created_at: new Date().toISOString(),
      }
      setSavedSearches((prev) => [newSearch, ...prev])
    },
    []
  )

  const removeSavedSearch = useCallback(async (searchId: string) => {
    setSavedSearches((prev) => prev.filter((s) => s.id !== searchId))
  }, [])

  const toggleSearchAlert = useCallback(
    async (searchId: string, enabled: boolean, frequency?: 'immediate' | 'daily' | 'weekly') => {
      setSavedSearches((prev) =>
        prev.map((s) =>
          s.id === searchId
            ? { ...s, alert_enabled: enabled, alert_frequency: enabled ? frequency || 'daily' : null }
            : s
        )
      )
    },
    []
  )

  return {
    bookmarks, savedSearches, isLoading,
    addBookmark, removeBookmark,
    saveSearch, removeSavedSearch, toggleSearchAlert,
  }
}
```

#### `app/(auth)/saved/page.tsx`

```tsx
// app/(auth)/saved/page.tsx
'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState } from '@/components/shared/EmptyState'
import { useBookmarks } from '@/lib/hooks/useBookmarks'
import Link from 'next/link'

export default function SavedPage() {
  const {
    bookmarks, savedSearches,
    removeBookmark, removeSavedSearch, toggleSearchAlert,
  } = useBookmarks()

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 lg:px-8">
      <h1 className="mb-6 text-3xl font-bold">Saved Items</h1>

      <Tabs defaultValue="searches">
        <TabsList>
          <TabsTrigger value="searches">Saved Searches ({savedSearches.length})</TabsTrigger>
          <TabsTrigger value="bookmarks">Bookmarks ({bookmarks.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="searches" className="mt-6">
          {savedSearches.length > 0 ? (
            <div className="space-y-3">
              {savedSearches.map((search) => (
                <Card key={search.id} className="border-border bg-surface">
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="flex-1">
                      <p className="font-mono text-sm font-medium">{search.query}</p>
                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                        <span>Saved {new Date(search.created_at).toLocaleDateString()}</span>
                        {search.new_results_count > 0 && (
                          <Badge variant="outline" className="text-accent">{search.new_results_count} new</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={search.alert_enabled}
                          onCheckedChange={(checked) => toggleSearchAlert(search.id, checked, 'daily')}
                        />
                        <span className="text-xs text-muted-foreground">Alert</span>
                      </div>
                      {search.alert_enabled && (
                        <Select
                          value={search.alert_frequency || 'daily'}
                          onValueChange={(v) => toggleSearchAlert(search.id, true, v as 'immediate' | 'daily' | 'weekly')}
                        >
                          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="immediate">Immediate</SelectItem>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      <Link href={`/search?q=${encodeURIComponent(search.query)}`}>
                        <Button variant="outline" size="sm">Run Again</Button>
                      </Link>
                      <Button variant="ghost" size="sm" onClick={() => removeSavedSearch(search.id)}>Remove</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              variant="not-processed"
              title="No Saved Searches"
              description="Save a search from the search page to quickly re-run it later. Enable alerts to get notified when new results appear."
            />
          )}
        </TabsContent>

        <TabsContent value="bookmarks" className="mt-6">
          {bookmarks.length > 0 ? (
            <div className="space-y-3">
              {bookmarks.map((bookmark) => (
                <Card key={bookmark.id} className="border-border bg-surface">
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{bookmark.target_type}</Badge>
                        <Link
                          href={
                            bookmark.target_type === 'document' ? `/document/${bookmark.target_id}`
                              : bookmark.target_type === 'entity' ? `/entity/${bookmark.target_id}` : '#'
                          }
                          className="text-sm font-medium hover:underline"
                        >
                          {bookmark.target_title}
                        </Link>
                      </div>
                      {bookmark.notes && <p className="mt-1 text-xs text-muted-foreground">{bookmark.notes}</p>}
                      <span className="mt-1 text-xs text-muted-foreground">
                        Saved {new Date(bookmark.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeBookmark(bookmark.id)}>Remove</Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              variant="not-processed"
              title="No Bookmarks"
              description="Bookmark documents, entities, and redactions to save them for quick access."
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

### Step 7: Build the Notification System — Session 2

#### `lib/hooks/useNotifications.ts`

```typescript
// lib/hooks/useNotifications.ts
'use client'

import { useState, useCallback, useEffect } from 'react'
import type { Notification, NotificationPreferences } from '@/types/notifications'

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    proposal_updates: true,
    annotation_replies: true,
    search_alerts: true,
    achievements: true,
    bounty_updates: true,
    investigation_updates: true,
    email_digest: 'daily',
  })

  const unreadCount = notifications.filter((n) => !n.is_read).length

  // Will subscribe to Supabase Realtime channel for push notifications
  useEffect(() => {
    // Placeholder: In Phase 6, subscribe to:
    // supabase.channel('notifications:user_id').on('INSERT', ...).subscribe()
    return () => { /* Unsubscribe on unmount */ }
  }, [])

  const markAsRead = useCallback(async (notificationId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
    )
  }, [])

  const markAllAsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
  }, [])

  const updatePreferences = useCallback(async (prefs: Partial<NotificationPreferences>) => {
    setPreferences((prev) => ({ ...prev, ...prefs }))
  }, [])

  return {
    notifications, unreadCount, isLoading, preferences,
    markAsRead, markAllAsRead, updatePreferences,
  }
}
```

#### `components/notifications/NotificationCenter.tsx`

```tsx
// components/notifications/NotificationCenter.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { NotificationItem } from './NotificationItem'
import { NotificationSettings } from './NotificationSettings'
import { useNotifications } from '@/lib/hooks/useNotifications'

export function NotificationCenter() {
  const { notifications, unreadCount, markAllAsRead } = useNotifications()
  const [isOpen, setIsOpen] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  return (
    <div className="relative">
      {/* Bell icon */}
      <Button
        variant="ghost"
        size="sm"
        className="relative"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Notifications"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <Badge className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent p-0 text-[10px]">
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </Button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-96 rounded-xl border border-border bg-background shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-xs">Mark all read</Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => setShowSettings((prev) => !prev)} title="Settings">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </Button>
            </div>
          </div>

          {showSettings ? (
            <NotificationSettings />
          ) : (
            <ScrollArea className="max-h-96">
              {notifications.length > 0 ? (
                <div className="divide-y divide-border">
                  {notifications.map((notification) => (
                    <NotificationItem key={notification.id} notification={notification} />
                  ))}
                </div>
              ) : (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm text-muted-foreground">No notifications yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    You will be notified about proposal votes, annotation replies, and more.
                  </p>
                </div>
              )}
            </ScrollArea>
          )}
        </div>
      )}
    </div>
  )
}
```

#### `components/notifications/NotificationItem.tsx`

```tsx
// components/notifications/NotificationItem.tsx
'use client'

import Link from 'next/link'
import { useNotifications } from '@/lib/hooks/useNotifications'
import type { Notification } from '@/types/notifications'

interface NotificationItemProps {
  notification: Notification
}

export function NotificationItem({ notification }: NotificationItemProps) {
  const { markAsRead } = useNotifications()

  const handleClick = () => {
    if (!notification.is_read) markAsRead(notification.id)
  }

  const content = (
    <div
      className={`flex gap-3 px-4 py-3 transition-colors hover:bg-surface-elevated ${
        !notification.is_read ? 'bg-accent/5' : ''
      }`}
      onClick={handleClick}
    >
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${!notification.is_read ? 'font-medium' : 'text-muted-foreground'}`}>
          {notification.title}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{notification.body}</p>
        <time className="mt-1 text-[10px] text-muted-foreground">
          {new Date(notification.created_at).toLocaleDateString(undefined, {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
          })}
        </time>
      </div>
      {!notification.is_read && (
        <div className="flex-shrink-0 self-center">
          <div className="h-2 w-2 rounded-full bg-accent" />
        </div>
      )}
    </div>
  )

  if (notification.link) return <Link href={notification.link}>{content}</Link>
  return content
}
```

#### `components/notifications/NotificationSettings.tsx`

```tsx
// components/notifications/NotificationSettings.tsx
'use client'

import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useNotifications } from '@/lib/hooks/useNotifications'

export function NotificationSettings() {
  const { preferences, updatePreferences } = useNotifications()

  return (
    <div className="space-y-4 p-4">
      <h4 className="text-sm font-semibold">Notification Preferences</h4>

      <div className="space-y-3">
        {[
          { key: 'proposal_updates' as const, label: 'Proposal updates', desc: 'Votes and status changes on your proposals' },
          { key: 'annotation_replies' as const, label: 'Annotation replies', desc: 'Replies to your document annotations' },
          { key: 'search_alerts' as const, label: 'Search alerts', desc: 'New results matching your saved searches' },
          { key: 'achievements' as const, label: 'Achievements', desc: 'XP milestones and level ups' },
          { key: 'bounty_updates' as const, label: 'Bounty updates', desc: 'Changes to bounties you claimed or created' },
          { key: 'investigation_updates' as const, label: 'Investigation updates', desc: 'Activity in threads you follow' },
        ].map(({ key, label, desc }) => (
          <div key={key} className="flex items-center justify-between">
            <div>
              <Label className="text-sm">{label}</Label>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
            <Switch
              checked={preferences[key]}
              onCheckedChange={(checked) => updatePreferences({ [key]: checked })}
            />
          </div>
        ))}
      </div>

      <Separator />

      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm">Email digest</Label>
          <p className="text-xs text-muted-foreground">Summary of notifications by email</p>
        </div>
        <Select
          value={preferences.email_digest}
          onValueChange={(v) => updatePreferences({ email_digest: v as 'none' | 'daily' | 'weekly' })}
        >
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
```

#### Add NotificationCenter to Header

Update the Header component from Phase 1 to include the NotificationCenter. Add this import and component inside the header's right-side controls area:

```tsx
// In components/layout/Header.tsx — add:
import { NotificationCenter } from '@/components/notifications/NotificationCenter'

// Render in the header right section, before the user avatar/menu:
// <NotificationCenter />
```

### Step 8: Build User Profile Pages — Session 3

#### `app/(auth)/profile/page.tsx`

```tsx
// app/(auth)/profile/page.tsx
'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { UserReputation } from '@/components/redaction/UserReputation'
import { EmptyState } from '@/components/shared/EmptyState'
import type { UserProfile, ContributionHistoryItem } from '@/types/profile'

export default function ProfilePage() {
  // Will fetch from /api/profile in Phase 6
  const [profile, setProfile] = useState<UserProfile>({
    id: 'current-user',
    display_name: 'Researcher',
    avatar_url: null,
    bio: null,
    reputation_tier: 'newcomer',
    accuracy_rate: 0,
    xp: 0,
    level: 1,
    proposals_submitted: 0,
    proposals_confirmed: 0,
    cascades_triggered: 0,
    annotations_count: 0,
    investigations_count: 0,
    joined_at: new Date().toISOString(),
  })

  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(profile.display_name)
  const [editBio, setEditBio] = useState(profile.bio || '')

  const contributions: ContributionHistoryItem[] = []

  const handleSave = () => {
    setProfile((prev) => ({ ...prev, display_name: editName, bio: editBio || null }))
    setIsEditing(false)
    // Will PUT to /api/profile
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 lg:px-8">
      {/* Profile Header */}
      <div className="mb-8 flex items-start gap-6">
        <Avatar className="h-20 w-20">
          <AvatarFallback className="text-2xl">
            {profile.display_name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1">
          {isEditing ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Display Name</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="max-w-sm" />
              </div>
              <div className="space-y-1">
                <Label>Bio</Label>
                <Textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} rows={3} className="max-w-lg" placeholder="Tell the community about yourself..." />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave}>Save</Button>
                <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">{profile.display_name}</h1>
                <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>Edit</Button>
              </div>
              {profile.bio && <p className="mt-1 text-sm text-muted-foreground">{profile.bio}</p>}
              <div className="mt-2">
                <UserReputation
                  tier={profile.reputation_tier}
                  accuracyRate={profile.accuracy_rate}
                  proposalCount={profile.proposals_submitted}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Member since {new Date(profile.joined_at).toLocaleDateString()}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Stats Dashboard */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: 'XP', value: profile.xp },
          { label: 'Level', value: profile.level },
          { label: 'Proposals', value: profile.proposals_submitted },
          { label: 'Confirmed', value: profile.proposals_confirmed },
          { label: 'Cascades', value: profile.cascades_triggered },
          { label: 'Annotations', value: profile.annotations_count },
        ].map(({ label, value }) => (
          <Card key={label} className="border-border bg-surface">
            <CardContent className="pt-4 text-center">
              <div className="text-xl font-bold">{value}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Separator className="mb-8" />

      {/* Tabs */}
      <Tabs defaultValue="contributions">
        <TabsList>
          <TabsTrigger value="contributions">Contributions</TabsTrigger>
          <TabsTrigger value="investigations">Investigations</TabsTrigger>
          <TabsTrigger value="annotations">Annotations</TabsTrigger>
          <TabsTrigger value="saved">Saved Items</TabsTrigger>
        </TabsList>

        <TabsContent value="contributions" className="mt-6">
          {contributions.length > 0 ? (
            <div className="space-y-3">
              {contributions.map((item) => (
                <Card key={item.id} className="border-border bg-surface">
                  <CardContent className="flex items-center justify-between py-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{item.type}</Badge>
                        <span className="text-sm font-medium">{item.title}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                      <span className="text-xs text-muted-foreground">
                        {new Date(item.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <Badge variant="outline" className="text-accent">+{item.xp_earned} XP</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              variant="not-processed"
              title="No Contributions Yet"
              description="Start contributing by solving redactions, adding annotations, or starting investigation threads."
            />
          )}
        </TabsContent>

        <TabsContent value="investigations" className="mt-6">
          <EmptyState
            variant="not-processed"
            title="No Investigations"
            description="Investigation threads you create or follow will appear here."
          />
        </TabsContent>

        <TabsContent value="annotations" className="mt-6">
          <EmptyState
            variant="not-processed"
            title="No Annotations"
            description="Your most upvoted document annotations will appear here."
          />
        </TabsContent>

        <TabsContent value="saved" className="mt-6">
          <EmptyState
            variant="not-processed"
            title="No Saved Items"
            description="Bookmarked documents, entities, and saved searches will appear here."
          />
        </TabsContent>
      </Tabs>

      {/* Export */}
      <div className="mt-8 text-center">
        <Button variant="outline" disabled>
          Export My Contributions (coming soon)
        </Button>
      </div>
    </div>
  )
}
```

### Step 9: Set up Supabase Realtime — Session 3

#### `lib/realtime/subscriptions.ts`

```typescript
// lib/realtime/subscriptions.ts
'use client'

import { useEffect, useRef } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'

// This module provides hooks for subscribing to Supabase Realtime channels.
// Each hook creates a channel subscription on mount and cleans up on unmount.
// All hooks are no-ops until Supabase client is configured in Phase 6.

interface RealtimeConfig {
  channel: string
  table: string
  event: 'INSERT' | 'UPDATE' | 'DELETE' | '*'
  filter?: string
}

/**
 * Hook to subscribe to Supabase Realtime changes on a table.
 * Returns void — the callback fires when matching changes occur.
 *
 * Usage:
 *   useRealtimeSubscription(
 *     { channel: 'notifications', table: 'notifications', event: 'INSERT', filter: `user_id=eq.${userId}` },
 *     (payload) => addNotification(payload.new)
 *   )
 */
export function useRealtimeSubscription(
  config: RealtimeConfig,
  callback: (payload: { new: Record<string, unknown>; old: Record<string, unknown> }) => void
) {
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    // Will initialize in Phase 6 when Supabase client is available:
    //
    // const supabase = createBrowserClient()
    // channelRef.current = supabase
    //   .channel(config.channel)
    //   .on('postgres_changes', {
    //     event: config.event,
    //     schema: 'public',
    //     table: config.table,
    //     filter: config.filter,
    //   }, callback)
    //   .subscribe()

    return () => {
      channelRef.current?.unsubscribe()
    }
  }, [config.channel, config.table, config.event, config.filter, callback])
}

/**
 * Hook to subscribe to real-time notification updates for the current user.
 */
export function useRealtimeNotifications(
  userId: string | null,
  onNewNotification: (notification: Record<string, unknown>) => void
) {
  useRealtimeSubscription(
    {
      channel: `notifications:${userId}`,
      table: 'notifications',
      event: 'INSERT',
      filter: userId ? `user_id=eq.${userId}` : undefined,
    },
    (payload) => {
      if (payload.new) onNewNotification(payload.new)
    }
  )
}

/**
 * Hook to subscribe to real-time proposal vote updates for a redaction.
 */
export function useRealtimeProposalVotes(
  redactionId: string,
  onVoteUpdate: (proposal: Record<string, unknown>) => void
) {
  useRealtimeSubscription(
    {
      channel: `proposals:${redactionId}`,
      table: 'redaction_proposals',
      event: 'UPDATE',
      filter: `redaction_id=eq.${redactionId}`,
    },
    (payload) => {
      if (payload.new) onVoteUpdate(payload.new)
    }
  )
}

/**
 * Hook to subscribe to real-time discovery feed updates.
 */
export function useRealtimeDiscoveries(
  onNewDiscovery: (discovery: Record<string, unknown>) => void
) {
  useRealtimeSubscription(
    {
      channel: 'discoveries',
      table: 'discoveries',
      event: 'INSERT',
    },
    (payload) => {
      if (payload.new) onNewDiscovery(payload.new)
    }
  )
}
```

### Step 10: Verify build

```bash
pnpm build
```

Fix any TypeScript errors. The most common will be:
- Missing shadcn/ui components (run the install commands from Step 1 again)
- Import path issues (verify `@/` alias resolves correctly)
- Missing type exports (check that all types from Step 3 are exported)

---

## Gotchas

1. **ChatFAB renders in root layout:** The `ChatFAB` component must be added to `app/layout.tsx`, not to individual page layouts. This ensures the chat panel persists across navigations without losing message history. If placed inside a route group layout, state resets on every navigation.

2. **Chat state reset on full-page reload:** The `useChat` hook stores messages in React state. A full page reload clears messages. Session persistence (localStorage or server-side) should be added in Phase 6 when the chat API is wired up. Do not add localStorage persistence now — it complicates SSE streaming integration later.

3. **Rate limit is client-side only for now:** The rate limit counter in `useChat` is a client-side approximation. Real rate limiting happens server-side in the `/api/chat` route (Phase 6). The client counter prevents unnecessary requests but is not a security mechanism.

4. **Notification dropdown z-index conflicts:** The NotificationCenter dropdown uses `z-50`. The ChatPanel also uses `z-50`. If both are open simultaneously, the chat panel should render on top since it was opened more recently. The current implementation handles this because the chat panel appears at `bottom-24 right-6` while notifications appear at `top-full right-0` of the header — they do not overlap spatially.

5. **Supabase Realtime requires auth:** Realtime subscriptions in `lib/realtime/subscriptions.ts` will only work for authenticated users. Anonymous users cannot subscribe to filtered channels. The hooks are designed to no-op when `userId` is null.

6. **Switch component requires radix-ui:** The shadcn `Switch` component depends on `@radix-ui/react-switch`. If the install in Step 1 fails, run `pnpm add @radix-ui/react-switch` manually.

7. **Proposal voting requires auth gate:** The `ProposalVoting` component allows voting without checking auth state. Wrap vote handlers with an auth check in Phase 6 — for now, votes are client-side only and do not persist.

8. **ReactMarkdown bundle size:** `react-markdown` with `remark-gfm` adds approximately 50KB to the client bundle. Since the ChatPanel is lazily rendered (only mounts when opened), this is acceptable. Do not statically import it in server components.

9. **Saved search alerts need a cron job:** The "alert me when new results match" feature requires a server-side cron job that periodically re-runs saved searches and compares results. This is implemented in Phase 6. The UI toggle in Phase 5 only sets the flag in the database.

10. **Profile page is auth-required:** The profile page is in the `(auth)` route group. The layout should redirect unauthenticated users to `/login?redirect=/profile`. This redirect logic is added in Phase 4's auth layout — verify it works before testing the profile page.

---

## Files to Create

```
types/
├── chat.ts
├── redaction.ts
├── notifications.ts
└── profile.ts
lib/hooks/
├── useChat.ts
├── useRedaction.ts
├── useBookmarks.ts
└── useNotifications.ts
lib/realtime/
└── subscriptions.ts
components/chat/
├── ChatFAB.tsx
├── ChatPanel.tsx
├── ChatMessage.tsx
├── ChatInput.tsx
└── SourceCitation.tsx
components/redaction/
├── RedactionCard.tsx
├── SolvableFeed.tsx
├── ProposalForm.tsx
├── ProposalVoting.tsx
├── CascadeTree.tsx
└── UserReputation.tsx
components/engagement/
└── DailyChallenge.tsx
components/notifications/
├── NotificationCenter.tsx
├── NotificationItem.tsx
└── NotificationSettings.tsx
app/(public)/
└── redactions/
    └── page.tsx
app/(auth)/
├── saved/
│   └── page.tsx
└── profile/
    └── page.tsx
```

Update existing files:
- `app/layout.tsx` — add `<ChatFAB />` import and render
- `components/layout/Header.tsx` — add `<NotificationCenter />` import and render

## Acceptance Criteria

1. Chat FAB appears on every page (bottom-right corner) with pulse animation on first visit
2. ChatPanel slides open (400px from right) with message UI and suggestion buttons
3. Chat input accepts text and sends (mock response for now, SSE streaming in Phase 6)
4. Source citations appear below AI messages as clickable chips that link to document pages
5. Chat rate limit counter decrements on each message and shows upgrade link when low
6. Redaction dashboard shows progress bar, stats cards, daily challenge, and tab navigation
7. Solvable feed shows sort/filter dropdowns with empty state when no data
8. RedactionCard displays surrounding text with redaction block, meta info, and action buttons
9. ProposalForm validates required fields (proposed text, evidence type, description) before submission
10. ProposalVoting shows confidence meter and allows Agree/Disagree/Corroborate voting
11. CascadeTree shows static placeholder for cascade visualization
12. DailyChallenge shows countdown timer and empty state when no challenge is loaded
13. Saved searches page shows list with alert toggle (Switch + frequency Select)
14. Bookmarks page shows list with target type badge and remove button
15. NotificationCenter bell icon shows unread count badge
16. NotificationCenter dropdown lists notifications with unread indicator
17. Notification settings panel allows toggling each notification type and email digest frequency
18. User profile page shows editable display name and bio
19. Profile stats dashboard shows 6 stat cards (XP, Level, Proposals, Confirmed, Cascades, Annotations)
20. Profile tabs show Contributions, Investigations, Annotations, and Saved Items with empty states
21. UserReputation badge renders with correct tier color and stats
22. Supabase Realtime hooks exist as no-op placeholders ready for Phase 6 wiring
23. All pages in `(auth)` route group redirect to login when not authenticated
24. Mobile responsive at 320px-768px (chat panel goes full-width on small screens)
25. `pnpm build` succeeds with zero errors

## Design Notes

- Chat panel: 400px width, dark background matching the app theme. On mobile (<640px), it should expand to full screen width.
- Chat message bubbles: user messages right-aligned with accent background, AI messages left-aligned with surface background.
- Typing indicator: three bouncing dots with staggered animation delays (0ms, 150ms, 300ms).
- Source citation pills: compact rounded-full design with document icon, accent text color. Hover shows preview popover.
- Redaction block styling: `border-dashed border-red-600 bg-black` for unsolved, `border-solid border-green-500 bg-green-950/20` for solved — consistent with Phase 3's `RedactionHighlight` component.
- Status badge colors: unsolved=red, proposed=amber, corroborated=blue, confirmed=green, disputed=purple.
- Reputation tier colors: newcomer=zinc, contributor=blue, researcher=purple, expert=amber, authority=green.
- Notification unread indicator: small `bg-accent` dot, 2px diameter. Unread background: `bg-accent/5`.
- Profile avatar: uses first character of display name as fallback. Phase 9 (polish) will add image upload.
- Daily challenge card: accent border (`border-accent/30`) and subtle accent background (`bg-accent/5`) to stand out from regular cards.

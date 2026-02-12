# Phase 4: Backend API

> **Sessions:** 2 | **Dependencies:** Phase 2 (database) | **Parallel with:** Phase 3 (Core UI)

## Summary

Build the AI provider abstraction layer, search library, all API routes, auth middleware, and utility libraries. This connects the frontend to the database and sets up the infrastructure for AI-powered features.

## Checklist

### AI Provider Abstractions

- [ ] `lib/ai/interfaces.ts` — All abstract interfaces
  - `EmbeddingProvider` (embed, embedBatch)
  - `VisualEmbeddingProvider` (embedImage, embedTextForImageSearch)
  - `ChatProvider` (complete, stream, supportsTools)
  - `RerankProvider` (rerank)
  - `OCRProvider` (process)
  - `ClassifierProvider` (classify)
  - `TranscriptionProvider` (transcribe)

- [ ] `lib/ai/types.ts` — Shared types
  - `EmbeddingResult`, `ChatMessage`, `ChatStreamEvent`
  - `ToolCall`, `ToolDefinition`, `ChatCompletionOptions`
  - `RerankResult`, `OCRResult`, `OCRPage`, `OCRBlock`
  - `ClassificationResult`, `DocumentClassification` union type
  - `TranscriptionResult`, `TranscriptSegment`
  - `AIProviderError` class

- [ ] `lib/ai/factory.ts` — Factory functions
  - `getEmbeddingProvider()` — reads `EMBEDDING_PROVIDER` env var
  - `getVisualEmbeddingProvider()` — reads `VISUAL_EMBEDDING_PROVIDER`
  - `getChatProvider(tier)` — reads `FREE_CHAT_PROVIDER` / `PAID_CHAT_PROVIDER`
  - `getRerankProvider()` — reads `RERANK_PROVIDER`
  - `getOCRProvider()` — reads `OCR_PROVIDER`
  - `getClassifierProvider()` — wraps chat provider
  - `getTranscriptionProvider()` — reads `TRANSCRIPTION_PROVIDER`

- [ ] `lib/ai/providers/google-vertex.ts` — Google Vertex text-embedding-004 (768d)
- [ ] `lib/ai/providers/google-multimodal.ts` — Google multimodalembedding@001 (1408d)
- [ ] `lib/ai/providers/gemini-flash.ts` — Gemini 2.0 Flash (free tier chat)
- [ ] `lib/ai/providers/anthropic-claude.ts` — Claude Sonnet/Opus (paid tier chat)
- [ ] `lib/ai/providers/cohere-reranker.ts` — Cohere rerank-english-v3.0
- [ ] `lib/ai/providers/google-document-ai.ts` — Google Document AI OCR
- [ ] `lib/ai/providers/whisper.ts` — Whisper transcription

### Search Library

- [ ] `lib/search/hybrid-search.ts` — RPC wrapper for `hybrid_search_chunks_rrf`
  - Accept query + filters, generate embedding, call Supabase RPC
  - Return typed `SearchResult[]`
- [ ] `lib/search/multimodal-search.ts` — RPC wrapper for `multimodal_search_rrf`
  - Accept query, generate both 768d and 1408d embeddings
  - Call Supabase RPC with type filters (documents, images, videos)
- [ ] `lib/search/entity-search.ts` — Entity-specific search
  - Search by name (trigram + embedding)
  - Filter by entity type
  - Return typed `Entity[]`

### API Routes — Search

- [ ] `app/api/search/route.ts` — Hybrid search endpoint
  - POST: query, filters (dataset, doc_type, date_from, date_to), page, limit
  - Validates with Zod schema
  - Calls hybrid search → optional rerank → return results
  - Returns: `{ data: SearchResult[], meta: { page, total, hasMore } }`

- [ ] `app/api/search/multimodal/route.ts` — Cross-modal search
  - POST: query, modalities (documents, images, videos), filters
  - Calls multimodal search RPC
  - Returns unified result list

### API Routes — Chat

- [ ] `app/api/chat/route.ts` — Chat/Q&A endpoint (streaming SSE)
  - POST: messages[], sessionId, tier (free/paid)
  - Rate limiting check (20/day free tier)
  - Create/update chat_conversations record
  - Stream response via SSE (data: {type, content})
  - Include citations in response
  - Model routing based on tier

### API Routes — Entity

- [ ] `app/api/entity/[id]/route.ts` — Entity details
  - GET: Return entity with mentions count, document count, aliases
  - Include related entities (top 10 by relationship strength)

- [ ] `app/api/entity/[id]/connections/route.ts` — Entity relationship graph data
  - GET: Return nodes (entities) and edges (relationships)
  - Depth parameter (default 2)
  - Limit parameter (default 50 nodes)

### API Routes — Document

- [ ] `app/api/document/[id]/route.ts` — Document metadata + chunks
  - GET: Return document metadata + paginated chunks
  - Include redaction highlights for the document

### API Routes — Timeline

- [ ] `app/api/timeline/route.ts` — Timeline events query
  - GET: entity_id (optional), date_from, date_to, event_type, limit
  - Return chronological events with source documents

### API Routes — Redaction

- [ ] `app/api/redaction/[id]/propose/route.ts` — Submit proposal (auth required)
  - POST: proposed_text, evidence_type, evidence_description, evidence_sources[], supporting_chunk_ids[]
  - Auth middleware check
  - Create redaction_proposals record
  - Return proposal with initial confidence scoring

- [ ] `app/api/redaction/[id]/vote/route.ts` — Vote on proposal (auth required)
  - POST: proposal_id, vote_type (upvote/downvote/corroborate)
  - Auth middleware check
  - Upsert proposal_votes record
  - Update proposal vote counts

- [ ] `app/api/redactions/dashboard/route.ts` — Redaction stats + leaderboard
  - GET: Return redaction stats (total, solved, proposed, etc.)
  - Top contributors

- [ ] `app/api/redactions/solvable/route.ts` — "Almost solvable" feed
  - GET: Return redactions sorted by potential_cascade_count DESC
  - Paginated

### API Routes — Stats

- [ ] `app/api/stats/route.ts` — Corpus processing stats
  - GET: Return corpus_stats materialized view data

### API Routes — Random & Discovery

- [ ] `app/api/random-document/route.ts` — Random document for discovery
  - GET: Return a random document ID (weighted toward unreviewed documents)
  - Optional filter: dataset, doc_type

- [ ] `app/api/discoveries/route.ts` — Public discovery feed
  - GET: Recent confirmed solves, new entity connections, pattern discoveries
  - Paginated, filterable by type

- [ ] `app/api/discoveries/today-in-history/route.ts` — "This Day in the Files"
  - GET: Documents with dates matching today's month+day in any year
  - Returns document summaries + date context

- [ ] `app/api/document/[id]/similar/route.ts` — "More Like This"
  - GET: Semantically similar documents via embedding similarity
  - Returns top 10 similar documents

- [ ] `app/api/entity/[id]/dossier/route.ts` — Evidence dossier for prosecutors
  - GET: Auto-generated prosecutor-ready summary
  - All documents mentioning entity, relationship evidence, timeline of involvement
  - Formatted for legal review with full citations

### API Routes — Annotations & Collaboration

- [ ] `app/api/annotations/route.ts` — Document annotations
  - GET: Annotations for a document/chunk (with pagination)
  - POST: Create annotation (auth required)

- [ ] `app/api/annotations/[id]/vote/route.ts` — Vote on annotation
  - POST: Upvote/downvote annotation (auth required)

- [ ] `app/api/investigation-threads/route.ts` — Investigation threads
  - GET: List public threads (paginated, filterable)
  - POST: Create thread (auth required)

- [ ] `app/api/investigation-threads/[id]/route.ts` — Thread details
  - GET: Thread with items
  - PUT: Update thread (owner only)
  - POST: Add item to thread (owner + followers)

- [ ] `app/api/ocr-corrections/route.ts` — OCR corrections
  - GET: Corrections for a document
  - POST: Submit correction (auth required)

- [ ] `app/api/notifications/route.ts` — Notification center
  - GET: User's notifications (paginated, unread count)
  - PUT: Mark as read

- [ ] `app/api/bounties/route.ts` — Research bounties
  - GET: Open bounties (filterable, sortable by XP reward)
  - POST: Create bounty (auth required, level 3+)

- [ ] `app/api/facts/route.ts` — Fact registry
  - GET: Verified facts (searchable)
  - POST: Propose fact with evidence (auth required)

### API Routes — Content-Type Browse

- [ ] `app/api/photos/route.ts` — Photo gallery data
  - GET: Paginated images with filters (dataset, date, has_redaction, has_people)

- [ ] `app/api/audio/route.ts` — Audio file listing
  - GET: Audio files with metadata, grouped by type/dataset

- [ ] `app/api/flights/route.ts` — Structured flight log data
  - GET: Flight records with passenger, date, aircraft, origin/destination filters

### API Routes — Auth

- [ ] `app/api/auth/callback/route.ts` — Supabase auth callback
  - GET: Exchange code for session
  - Redirect to origin or home page
  - Create user_profile record on first login
  - Run onboarding quiz results processing

### Middleware & Auth

- [ ] `lib/auth/middleware.ts` — Auth middleware for protected routes
  - Extract session from request
  - Return 401 if not authenticated
  - Attach user to request context

- [ ] `lib/auth/rate-limit.ts` — Rate limiting stubs
  - Per-user limits (chat: 20/day free)
  - Per-IP limits for anonymous
  - Returns 429 when exceeded

### Utility Libraries

- [ ] `lib/utils/citations.ts` — Citation formatting helpers
  - Format citation string: "[Document Name, Page X]"
  - Parse citation references from text
  - Generate clickable citation links

- [ ] `lib/utils/dates.ts` — Date parsing and formatting
  - Parse various date formats from OCR text
  - Display dates with precision level (exact, day, month, year, approximate)
  - Format date ranges

- [ ] `lib/utils/storage.ts` — Supabase Storage signed URL generation
  - Generate signed URLs for document/image downloads
  - URL expiry configuration

- [ ] `lib/utils/dossier.ts` — Evidence dossier generation
  - Compile all evidence for an entity into prosecutor-ready format
  - Sections: Involvement Summary, Key Documents (with citations), Relationship Map, Timeline, Cross-References, Potential Criminal Activity Indicators
  - Output as structured JSON (rendered by frontend) or PDF

- [ ] `lib/utils/export.ts` — Citation export utilities
  - Export document references as BibTeX, RIS, Zotero-compatible formats
  - Export entity dossier as PDF
  - Export investigation thread as report

### Chat Library (Client-side)

- [ ] `lib/chat/chat-service.ts` — Chat orchestration (client-side)
  - Send message to API
  - Handle SSE stream parsing
  - Manage conversation state

- [ ] `lib/chat/streaming.ts` — SSE streaming utilities
  - Parse SSE events
  - Reconnection logic
  - Error handling for stream interruption

## Files to Create

```
lib/ai/
├── interfaces.ts
├── types.ts
├── factory.ts
└── providers/
    ├── google-vertex.ts
    ├── google-multimodal.ts
    ├── gemini-flash.ts
    ├── anthropic-claude.ts
    ├── cohere-reranker.ts
    ├── google-document-ai.ts
    └── whisper.ts
lib/search/
├── hybrid-search.ts
├── multimodal-search.ts
└── entity-search.ts
lib/chat/
├── chat-service.ts
└── streaming.ts
lib/auth/
├── middleware.ts
└── rate-limit.ts
lib/utils/
├── citations.ts
├── dates.ts
├── storage.ts
├── dossier.ts
└── export.ts
app/api/
├── search/
│   ├── route.ts
│   └── multimodal/
│       └── route.ts
├── chat/
│   └── route.ts
├── entity/[id]/
│   ├── route.ts
│   └── connections/
│       └── route.ts
├── document/[id]/
│   └── route.ts
├── timeline/
│   └── route.ts
├── redaction/[id]/
│   ├── propose/
│   │   └── route.ts
│   └── vote/
│       └── route.ts
├── redactions/
│   ├── dashboard/
│   │   └── route.ts
│   └── solvable/
│       └── route.ts
├── stats/
│   └── route.ts
├── random-document/
│   └── route.ts
├── discoveries/
│   ├── route.ts
│   └── today-in-history/
│       └── route.ts
├── document/[id]/similar/
│   └── route.ts
├── entity/[id]/dossier/
│   └── route.ts
├── annotations/
│   ├── route.ts
│   └── [id]/vote/
│       └── route.ts
├── investigation-threads/
│   ├── route.ts
│   └── [id]/
│       └── route.ts
├── ocr-corrections/
│   └── route.ts
├── notifications/
│   └── route.ts
├── bounties/
│   └── route.ts
├── facts/
│   └── route.ts
├── photos/
│   └── route.ts
├── audio/
│   └── route.ts
├── flights/
│   └── route.ts
└── auth/
    └── callback/
        └── route.ts
```

## Acceptance Criteria

1. AI provider factory returns correctly typed providers based on env vars
2. AI provider interfaces compile and match the design in `AI_PROVIDER_INTERFACES.md`
3. Search API (`POST /api/search`) returns correct response shape with Zod validation
4. Chat API (`POST /api/chat`) streams SSE events correctly
5. Protected routes (`/api/redaction/[id]/propose`, `/api/redaction/[id]/vote`) return 401 without auth
6. Auth callback correctly exchanges code for session
7. Stats API returns corpus_stats data
8. Entity API returns entity details with connections
9. All API routes handle errors gracefully (400 for bad input, 500 for server errors)
10. Citation utilities correctly format document references
11. Date utilities parse common date formats from OCR text
12. Rate limiting returns 429 when limits exceeded

## Notes

- AI providers should work with stub/mock implementations initially — real API calls need credentials
- Search functions depend on Supabase RPC — test with empty results until data is seeded
- Chat streaming uses Web Streams API (ReadableStream) for Next.js route handlers
- Provider implementations should throw `AIProviderError` for consistent error handling

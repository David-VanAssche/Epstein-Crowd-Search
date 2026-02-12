# AI Provider Interface Design

> **Abstract interfaces for all AI services.** Providers can be swapped (Google Vertex → Fireworks.ai, Gemini → x.ai Grok, etc.) without changing consuming code.

## Architecture

```
lib/ai/
├── interfaces.ts          # Abstract interfaces (EmbeddingProvider, ChatProvider, etc.)
├── factory.ts             # Factory functions that read env vars and return providers
├── types.ts               # Shared types (EmbeddingResult, ChatMessage, etc.)
├── providers/
│   ├── google-vertex.ts   # Google Vertex AI text-embedding-004
│   ├── google-multimodal.ts # Google multimodalembedding@001
│   ├── gemini-flash.ts    # Gemini 2.0 Flash (free tier chat)
│   ├── anthropic-claude.ts # Claude Sonnet/Opus (paid tier chat)
│   ├── cohere-reranker.ts # Cohere rerank-english-v3.0
│   ├── google-document-ai.ts # Google Document AI OCR
│   └── whisper.ts         # Whisper (video transcription)
└── __tests__/
    └── factory.test.ts    # Tests for factory pattern
```

## Core Interfaces

### EmbeddingProvider

```typescript
// lib/ai/interfaces.ts

export interface EmbeddingResult {
  embedding: number[]
  tokenCount: number
}

export interface EmbeddingProvider {
  readonly name: string
  readonly dimensions: number

  /** Embed a single text string */
  embed(text: string): Promise<EmbeddingResult>

  /** Embed multiple texts (batch for efficiency) */
  embedBatch(texts: string[], batchSize?: number): Promise<EmbeddingResult[]>
}

export interface VisualEmbeddingProvider {
  readonly name: string
  readonly dimensions: number

  /** Embed an image from a buffer or URL */
  embedImage(input: Buffer | string): Promise<EmbeddingResult>

  /** Embed text for cross-modal search (text→image) */
  embedTextForImageSearch(text: string): Promise<EmbeddingResult>
}
```

### ChatProvider

```typescript
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  toolCallId?: string
  toolCalls?: ToolCall[]
}

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

export interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown> // JSON Schema
}

export interface ChatStreamEvent {
  type: 'token' | 'tool_call' | 'tool_result' | 'done' | 'error'
  content?: string
  toolCall?: ToolCall
  usage?: { inputTokens: number; outputTokens: number }
}

export interface ChatCompletionOptions {
  messages: ChatMessage[]
  tools?: ToolDefinition[]
  temperature?: number        // default 0.3
  maxTokens?: number          // default 4096
  systemPrompt?: string
}

export interface ChatProvider {
  readonly name: string
  readonly model: string
  readonly tier: 'free' | 'paid'

  /** Non-streaming completion */
  complete(options: ChatCompletionOptions): Promise<ChatMessage>

  /** Streaming completion (yields events) */
  stream(options: ChatCompletionOptions): AsyncIterable<ChatStreamEvent>

  /** Check if this provider supports tool calling */
  supportsTools(): boolean
}
```

### RerankProvider

```typescript
export interface RerankResult {
  index: number
  relevanceScore: number
}

export interface RerankProvider {
  readonly name: string

  /** Rerank documents by relevance to query */
  rerank(
    query: string,
    documents: string[],
    topK?: number
  ): Promise<RerankResult[]>
}
```

### OCRProvider

```typescript
export interface OCRPage {
  pageNumber: number
  text: string
  confidence: number
  blocks: OCRBlock[]
}

export interface OCRBlock {
  text: string
  type: 'paragraph' | 'heading' | 'table' | 'list' | 'image_caption'
  confidence: number
  boundingBox?: { x: number; y: number; width: number; height: number }
}

export interface OCRResult {
  pages: OCRPage[]
  fullText: string
  markdown: string           // Structured markdown with headings
  pageCount: number
  totalConfidence: number    // Average confidence across pages
}

export interface OCRProvider {
  readonly name: string

  /** Process a document (PDF buffer or image buffer) */
  process(input: Buffer, mimeType: string): Promise<OCRResult>
}
```

### ClassifierProvider

```typescript
export type DocumentClassification =
  | 'deposition'
  | 'flight_log'
  | 'fbi_302'
  | 'financial'
  | 'email'
  | 'court_filing'
  | 'police_report'
  | 'estate_doc'
  | 'handwritten_note'
  | 'photo'
  | 'video'
  | 'news_clipping'
  | 'correspondence'
  | 'memo'
  | 'property_record'
  | 'other'

export interface ClassificationResult {
  classification: DocumentClassification
  confidence: number
  reasoning?: string
}

export interface ClassifierProvider {
  readonly name: string

  /** Classify a document based on its content */
  classify(text: string, filename?: string): Promise<ClassificationResult>
}
```

### TranscriptionProvider

```typescript
export interface TranscriptSegment {
  text: string
  start: number    // seconds
  end: number      // seconds
  confidence: number
}

export interface TranscriptionResult {
  fullText: string
  language: string
  segments: TranscriptSegment[]
  duration: number   // total seconds
}

export interface TranscriptionProvider {
  readonly name: string

  /** Transcribe audio/video file */
  transcribe(input: Buffer, mimeType: string): Promise<TranscriptionResult>
}
```

## Factory Pattern

```typescript
// lib/ai/factory.ts

import type {
  EmbeddingProvider,
  VisualEmbeddingProvider,
  ChatProvider,
  RerankProvider,
  OCRProvider,
  ClassifierProvider,
  TranscriptionProvider,
} from './interfaces'

// Environment-driven provider selection
// Each factory reads env vars to determine which provider to instantiate

export function getEmbeddingProvider(): EmbeddingProvider {
  const provider = process.env.EMBEDDING_PROVIDER || 'google-vertex'
  switch (provider) {
    case 'google-vertex':
      return new GoogleVertexEmbedder()
    // Future: case 'fireworks': return new FireworksEmbedder()
    default:
      throw new Error(`Unknown embedding provider: ${provider}`)
  }
}

export function getVisualEmbeddingProvider(): VisualEmbeddingProvider {
  const provider = process.env.VISUAL_EMBEDDING_PROVIDER || 'google-multimodal'
  switch (provider) {
    case 'google-multimodal':
      return new GoogleMultimodalEmbedder()
    default:
      throw new Error(`Unknown visual embedding provider: ${provider}`)
  }
}

export function getChatProvider(tier: 'free' | 'paid' = 'free'): ChatProvider {
  if (tier === 'paid') {
    const provider = process.env.PAID_CHAT_PROVIDER || 'anthropic'
    switch (provider) {
      case 'anthropic':
        return new AnthropicClaude()
      // Future: case 'xai': return new XAIGrok()
      default:
        throw new Error(`Unknown paid chat provider: ${provider}`)
    }
  }

  const provider = process.env.FREE_CHAT_PROVIDER || 'gemini-flash'
  switch (provider) {
    case 'gemini-flash':
      return new GeminiFlash()
    default:
      throw new Error(`Unknown free chat provider: ${provider}`)
  }
}

export function getRerankProvider(): RerankProvider {
  const provider = process.env.RERANK_PROVIDER || 'cohere'
  switch (provider) {
    case 'cohere':
      return new CohereReranker()
    default:
      throw new Error(`Unknown rerank provider: ${provider}`)
  }
}

export function getOCRProvider(): OCRProvider {
  const provider = process.env.OCR_PROVIDER || 'google-document-ai'
  switch (provider) {
    case 'google-document-ai':
      return new GoogleDocumentAI()
    default:
      throw new Error(`Unknown OCR provider: ${provider}`)
  }
}

export function getClassifierProvider(): ClassifierProvider {
  // Uses the free chat provider for classification
  const chatProvider = getChatProvider('free')
  return new LLMClassifier(chatProvider)
}

export function getTranscriptionProvider(): TranscriptionProvider {
  const provider = process.env.TRANSCRIPTION_PROVIDER || 'whisper'
  switch (provider) {
    case 'whisper':
      return new WhisperTranscriber()
    default:
      throw new Error(`Unknown transcription provider: ${provider}`)
  }
}
```

## Environment Variables for Provider Selection

```env
# Provider selection (defaults shown — only set if changing providers)
EMBEDDING_PROVIDER=google-vertex            # or 'fireworks'
VISUAL_EMBEDDING_PROVIDER=google-multimodal
FREE_CHAT_PROVIDER=gemini-flash             # or 'fireworks-deepseek'
PAID_CHAT_PROVIDER=anthropic                # or 'xai'
RERANK_PROVIDER=cohere
OCR_PROVIDER=google-document-ai
TRANSCRIPTION_PROVIDER=whisper

# Provider-specific credentials (only needed for active providers)
# Google
GOOGLE_APPLICATION_CREDENTIALS=
GOOGLE_CLOUD_PROJECT_ID=
GOOGLE_CLOUD_LOCATION=us-central1
DOCUMENT_AI_PROCESSOR_ID=

# Cohere
COHERE_API_KEY=

# Gemini
GEMINI_API_KEY=

# Anthropic
ANTHROPIC_API_KEY=

# Fireworks.ai (future)
FIREWORKS_API_KEY=

# x.ai (future)
XAI_API_KEY=

# Whisper
WHISPER_MODEL=large-v3
```

## Usage in Application Code

### API Route Example

```typescript
// app/api/search/route.ts
import { getEmbeddingProvider, getRerankProvider } from '@/lib/ai/factory'

export async function POST(request: NextRequest) {
  const { query } = await request.json()

  // Get providers via factory — never import specific providers
  const embedder = getEmbeddingProvider()
  const reranker = getRerankProvider()

  // Embed the query
  const { embedding } = await embedder.embed(query)

  // Search Supabase with embedding
  const results = await hybridSearch(query, embedding)

  // Rerank results
  const reranked = await reranker.rerank(
    query,
    results.map(r => r.content),
    20
  )

  return NextResponse.json({ data: reranked })
}
```

### Worker Example

```typescript
// worker/src/services/embedding-service.ts
import { getEmbeddingProvider } from '../ai/factory'

export async function embedChunks(chunks: string[]): Promise<number[][]> {
  const embedder = getEmbeddingProvider()
  const results = await embedder.embedBatch(chunks, 100) // batch of 100
  return results.map(r => r.embedding)
}
```

### Chat Example

```typescript
// app/api/chat/route.ts
import { getChatProvider } from '@/lib/ai/factory'

export async function POST(request: NextRequest) {
  const { messages, tier } = await request.json()

  const chatProvider = getChatProvider(tier)

  // Stream response via SSE
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      for await (const event of chatProvider.stream({ messages, tools })) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
        )
      }
      controller.close()
    }
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream' }
  })
}
```

## Adding a New Provider

To add a new provider (e.g., Fireworks.ai embeddings):

1. Create `lib/ai/providers/fireworks-embedding.ts`
2. Implement the `EmbeddingProvider` interface
3. Add a case to the factory switch in `lib/ai/factory.ts`
4. Add env var documentation
5. No other code changes needed — consuming code uses the interface

```typescript
// lib/ai/providers/fireworks-embedding.ts
import type { EmbeddingProvider, EmbeddingResult } from '../interfaces'

export class FireworksEmbedder implements EmbeddingProvider {
  readonly name = 'fireworks'
  readonly dimensions = 768

  async embed(text: string): Promise<EmbeddingResult> {
    // Fireworks.ai API call
  }

  async embedBatch(texts: string[], batchSize = 100): Promise<EmbeddingResult[]> {
    // Batched Fireworks.ai API call
  }
}
```

## Error Handling

All providers should throw `AIProviderError` for consistent error handling:

```typescript
// lib/ai/types.ts
export class AIProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly statusCode?: number,
    public readonly retryable: boolean = false,
  ) {
    super(message)
    this.name = 'AIProviderError'
  }
}
```

Consuming code can catch and handle provider errors uniformly:

```typescript
try {
  const result = await embedder.embed(text)
} catch (error) {
  if (error instanceof AIProviderError && error.retryable) {
    // Queue for retry
  } else {
    // Log and skip
  }
}
```

## Embedding Cache

A two-tier cache sits in front of embedding providers:

```
Request → L1 (in-memory LRU, ~10K entries) → L2 (Supabase lookup) → Provider API
```

The cache is implemented in `worker/src/services/embedding-cache.ts` and wraps any `EmbeddingProvider`. This avoids re-embedding identical chunks across processing runs.

```typescript
export class CachedEmbeddingProvider implements EmbeddingProvider {
  constructor(
    private inner: EmbeddingProvider,
    private cache: EmbeddingCache
  ) {}

  async embed(text: string): Promise<EmbeddingResult> {
    const cached = await this.cache.get(text)
    if (cached) return cached

    const result = await this.inner.embed(text)
    await this.cache.set(text, result)
    return result
  }
}
```

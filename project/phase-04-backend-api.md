# Phase 4: Backend API & Auth

> **Sessions:** 2-3 | **Dependencies:** Phase 2 (database + types), Phase 1 (project scaffold) | **Parallel with:** Phase 3 (Core UI)

## Summary

Build the complete backend: Supabase Auth integration (email + OAuth), auth middleware and route protection, all API route handlers (Next.js App Router), server-side data fetching libraries, rate limiting, and type-safe Supabase client wrappers. This phase connects the Phase 3 UI to the Phase 2 database and sets up the infrastructure for AI-powered features in later phases.

Every API route uses Zod for input validation, returns consistent JSON response shapes, and handles errors gracefully. Protected routes use auth middleware that returns 401 for unauthenticated requests. Rate limiting prevents abuse of expensive operations like chat and search.

## IMPORTANT: Pre-requisites

Before starting Phase 4, verify:
1. Phase 1 is complete (`pnpm dev` runs, `pnpm build` succeeds)
2. Phase 2 is complete (all migrations applied, Supabase clients exist in `lib/supabase/`)
3. Phase 3 pages exist (they render with empty states — this phase wires them to real data)
4. You have Supabase Auth enabled in the dashboard (Authentication > Providers > Email enabled)
5. `.env.local` has all required Supabase keys:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

---

## Step-by-Step Execution

### Step 1: Install additional dependencies

```bash
pnpm add zod
```

Zod is used for request body validation in every API route.

### Step 2: Create shared API response helpers

File: `lib/api/responses.ts`

```typescript
// lib/api/responses.ts
import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

export interface ApiResponse<T = unknown> {
  data: T | null
  error: string | null
  meta?: Record<string, unknown>
}

export interface PaginatedResponse<T = unknown> extends ApiResponse<T[]> {
  meta: {
    page: number
    per_page: number
    total: number
    has_more: boolean
  }
}

export function success<T>(data: T, meta?: Record<string, unknown>): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ data, error: null, meta })
}

export function paginated<T>(
  data: T[],
  page: number,
  per_page: number,
  total: number
): NextResponse<PaginatedResponse<T>> {
  return NextResponse.json({
    data,
    error: null,
    meta: {
      page,
      per_page,
      total,
      has_more: page * per_page < total,
    },
  })
}

export function error(message: string, status: number = 400): NextResponse<ApiResponse<null>> {
  return NextResponse.json({ data: null, error: message }, { status })
}

export function unauthorized(message: string = 'Authentication required'): NextResponse<ApiResponse<null>> {
  return NextResponse.json({ data: null, error: message }, { status: 401 })
}

export function forbidden(message: string = 'Forbidden'): NextResponse<ApiResponse<null>> {
  return NextResponse.json({ data: null, error: message }, { status: 403 })
}

export function notFound(message: string = 'Not found'): NextResponse<ApiResponse<null>> {
  return NextResponse.json({ data: null, error: message }, { status: 404 })
}

export function rateLimited(message: string = 'Rate limit exceeded'): NextResponse<ApiResponse<null>> {
  return NextResponse.json({ data: null, error: message }, { status: 429 })
}

export function serverError(message: string = 'Internal server error'): NextResponse<ApiResponse<null>> {
  return NextResponse.json({ data: null, error: message }, { status: 500 })
}

export function handleApiError(err: unknown): NextResponse<ApiResponse<null>> {
  if (err instanceof ZodError) {
    const messages = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`)
    return error(`Validation error: ${messages.join(', ')}`, 400)
  }

  if (err instanceof Error) {
    console.error('[API Error]', err.message, err.stack)
    return serverError(
      process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    )
  }

  console.error('[API Error] Unknown error:', err)
  return serverError()
}
```

### Step 3: Create auth middleware for protected routes

File: `lib/auth/middleware.ts`

```typescript
// lib/auth/middleware.ts
import { createClient } from '@/lib/supabase/server'
import { unauthorized } from '@/lib/api/responses'

export interface AuthenticatedUser {
  id: string
  email: string | undefined
  user_metadata: Record<string, unknown>
}

/**
 * Extracts the authenticated user from the request.
 * Returns the user if authenticated, null otherwise.
 * Use in API routes that need optional auth.
 */
export async function getUser(): Promise<AuthenticatedUser | null> {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  return {
    id: user.id,
    email: user.email,
    user_metadata: user.user_metadata,
  }
}

/**
 * Requires authentication. Returns the user or a 401 Response
 * that the route handler should return immediately.
 *
 * Usage in route handlers:
 * ```
 * const userOrResponse = await requireAuth()
 * if (userOrResponse instanceof Response) return userOrResponse
 * const user = userOrResponse
 * ```
 */
export async function requireAuth(): Promise<AuthenticatedUser | Response> {
  const user = await getUser()
  if (!user) {
    return unauthorized('You must be signed in to perform this action')
  }
  return user
}

/**
 * Requires a minimum user level/tier.
 * Checks the user_profiles table for tier status.
 */
export async function requireTier(
  minimumTier: 'contributor' | 'researcher' | 'moderator' | 'admin'
): Promise<AuthenticatedUser | Response> {
  const userOrResponse = await requireAuth()
  if (userOrResponse instanceof Response) return userOrResponse

  const user = userOrResponse
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('tier, level')
    .eq('id', user.id)
    .single()

  const tierHierarchy: Record<string, number> = {
    contributor: 1,
    researcher: 2,
    moderator: 3,
    admin: 4,
  }

  const userTierLevel = tierHierarchy[profile?.tier || 'contributor'] || 1
  const requiredTierLevel = tierHierarchy[minimumTier] || 1

  if (userTierLevel < requiredTierLevel) {
    return unauthorized(`Requires ${minimumTier} tier or higher`)
  }

  return user
}
```

### Step 4: Create rate limiting

File: `lib/auth/rate-limit.ts`

```typescript
// lib/auth/rate-limit.ts
import { rateLimited } from '@/lib/api/responses'

/**
 * Simple in-memory rate limiter.
 * For production, replace with Redis-backed solution (Upstash, etc.)
 *
 * In-memory maps are cleared on server restart, which is acceptable
 * for early development. Each serverless function instance has its
 * own map, so limits are per-instance, not global.
 */

interface RateLimitEntry {
  count: number
  reset_at: number // Unix timestamp in ms
}

const rateLimitMap = new Map<string, RateLimitEntry>()

// Clean up expired entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of rateLimitMap) {
      if (entry.reset_at < now) {
        rateLimitMap.delete(key)
      }
    }
  }, 5 * 60 * 1000)
}

export interface RateLimitConfig {
  /** Unique identifier prefix for the limit bucket (e.g., 'chat', 'search') */
  prefix: string
  /** Maximum number of requests allowed in the window */
  max_requests: number
  /** Window duration in seconds */
  window_seconds: number
}

export const RATE_LIMITS = {
  chat_free: { prefix: 'chat_free', max_requests: 20, window_seconds: 86400 } as RateLimitConfig,
  chat_paid: { prefix: 'chat_paid', max_requests: 200, window_seconds: 86400 } as RateLimitConfig,
  search: { prefix: 'search', max_requests: 60, window_seconds: 60 } as RateLimitConfig,
  proposal: { prefix: 'proposal', max_requests: 10, window_seconds: 3600 } as RateLimitConfig,
  vote: { prefix: 'vote', max_requests: 100, window_seconds: 3600 } as RateLimitConfig,
  annotation: { prefix: 'annotation', max_requests: 30, window_seconds: 3600 } as RateLimitConfig,
  general: { prefix: 'general', max_requests: 120, window_seconds: 60 } as RateLimitConfig,
} as const

/**
 * Check rate limit for a given identifier.
 *
 * @param identifier - User ID or IP address
 * @param config - Rate limit configuration
 * @returns null if within limits, or a Response with 429 status
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): Response | null {
  const key = `${config.prefix}:${identifier}`
  const now = Date.now()
  const entry = rateLimitMap.get(key)

  if (!entry || entry.reset_at < now) {
    rateLimitMap.set(key, {
      count: 1,
      reset_at: now + config.window_seconds * 1000,
    })
    return null
  }

  if (entry.count >= config.max_requests) {
    const retryAfterSeconds = Math.ceil((entry.reset_at - now) / 1000)
    const response = rateLimited(
      `Rate limit exceeded. Try again in ${retryAfterSeconds} seconds.`
    )
    response.headers.set('Retry-After', String(retryAfterSeconds))
    response.headers.set('X-RateLimit-Limit', String(config.max_requests))
    response.headers.set('X-RateLimit-Remaining', '0')
    response.headers.set('X-RateLimit-Reset', String(Math.ceil(entry.reset_at / 1000)))
    return response
  }

  entry.count++
  return null
}

/**
 * Get the client's IP address from the request headers.
 * Works behind Vercel, Cloudflare, and standard proxies.
 */
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  const realIP = request.headers.get('x-real-ip')
  if (realIP) return realIP
  return '127.0.0.1'
}
```

### Step 5: Create Zod validation schemas

File: `lib/api/schemas.ts`

```typescript
// lib/api/schemas.ts
import { z } from 'zod'

// --- Search ---
export const searchRequestSchema = z.object({
  query: z.string().min(1, 'Query is required').max(500, 'Query too long'),
  filters: z
    .object({
      dataset_id: z.string().uuid().optional(),
      doc_type: z.string().optional(),
      date_from: z.string().datetime().optional(),
      date_to: z.string().datetime().optional(),
      entity_id: z.string().uuid().optional(),
      has_redactions: z.boolean().optional(),
    })
    .optional(),
  page: z.number().int().min(1).default(1),
  per_page: z.number().int().min(1).max(100).default(20),
  sort: z.enum(['relevance', 'date_asc', 'date_desc', 'mentions']).default('relevance'),
})

export type SearchRequestInput = z.infer<typeof searchRequestSchema>

export const multimodalSearchRequestSchema = z.object({
  query: z.string().min(1).max(500),
  modalities: z
    .object({
      documents: z.boolean().default(true),
      images: z.boolean().default(true),
      videos: z.boolean().default(true),
    })
    .default({}),
  filters: z
    .object({
      dataset_id: z.string().uuid().optional(),
    })
    .optional(),
  page: z.number().int().min(1).default(1),
  per_page: z.number().int().min(1).max(100).default(20),
})

export type MultimodalSearchRequestInput = z.infer<typeof multimodalSearchRequestSchema>

// --- Chat ---
export const chatRequestSchema = z.object({
  message: z.string().min(1, 'Message is required').max(4000, 'Message too long'),
  conversation_id: z.string().uuid().optional(),
  session_id: z.string().min(1),
  model_tier: z.enum(['free', 'researcher', 'pro']).default('free'),
})

export type ChatRequestInput = z.infer<typeof chatRequestSchema>

// --- Redaction Proposal ---
export const proposalRequestSchema = z.object({
  proposed_text: z.string().min(1, 'Proposed text is required').max(1000),
  proposed_entity_id: z.string().uuid().optional(),
  evidence_type: z.enum([
    'public_statement',
    'cross_reference',
    'context_deduction',
    'document_comparison',
    'official_release',
    'media_report',
    'other',
  ]),
  evidence_description: z.string().min(10, 'Please provide a detailed description').max(5000),
  evidence_sources: z.array(z.string().max(2000)).max(10).default([]),
  supporting_chunk_ids: z.array(z.string().uuid()).max(20).default([]),
})

export type ProposalRequestInput = z.infer<typeof proposalRequestSchema>

// --- Vote ---
export const voteRequestSchema = z.object({
  proposal_id: z.string().uuid(),
  vote_type: z.enum(['upvote', 'downvote', 'corroborate']),
})

export type VoteRequestInput = z.infer<typeof voteRequestSchema>

// --- Timeline ---
export const timelineQuerySchema = z.object({
  entity_id: z.string().uuid().optional(),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
  event_type: z.string().optional(),
  page: z.number().int().min(1).default(1),
  per_page: z.number().int().min(1).max(100).default(50),
})

export type TimelineQueryInput = z.infer<typeof timelineQuerySchema>

// --- Annotation ---
export const annotationRequestSchema = z.object({
  document_id: z.string().uuid(),
  chunk_id: z.string().uuid().optional(),
  page_number: z.number().int().min(1).optional(),
  content: z.string().min(1).max(5000),
  annotation_type: z.enum(['question', 'observation', 'correction', 'connection']).default('observation'),
  parent_id: z.string().uuid().optional(),
})

export type AnnotationRequestInput = z.infer<typeof annotationRequestSchema>

// --- Investigation Thread ---
export const threadCreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  is_public: z.boolean().default(true),
  tags: z.array(z.string().max(50)).max(10).default([]),
})

export type ThreadCreateInput = z.infer<typeof threadCreateSchema>

export const threadItemSchema = z.object({
  item_type: z.enum(['document', 'entity', 'timeline_event', 'annotation', 'note', 'image']),
  target_id: z.string().uuid().optional(),
  note: z.string().max(5000).optional(),
})

export type ThreadItemInput = z.infer<typeof threadItemSchema>

// --- OCR Correction ---
export const ocrCorrectionSchema = z.object({
  document_id: z.string().uuid(),
  chunk_id: z.string().uuid().optional(),
  page_number: z.number().int().min(1).optional(),
  original_text: z.string().min(1).max(10000),
  corrected_text: z.string().min(1).max(10000),
})

export type OCRCorrectionInput = z.infer<typeof ocrCorrectionSchema>

// --- Bounty ---
export const bountyCreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(10).max(5000),
  entity_ids: z.array(z.string().uuid()).max(10).default([]),
  target_type: z.enum(['entity', 'redaction', 'question', 'pattern']),
  xp_reward: z.number().int().min(0).max(1000).default(0),
  expires_at: z.string().datetime().optional(),
})

export type BountyCreateInput = z.infer<typeof bountyCreateSchema>

// --- Fact ---
export const factCreateSchema = z.object({
  fact_text: z.string().min(10).max(2000),
  entity_ids: z.array(z.string().uuid()).max(20).default([]),
  supporting_chunk_ids: z.array(z.string().uuid()).max(20).default([]),
  supporting_document_ids: z.array(z.string().uuid()).max(20).default([]),
})

export type FactCreateInput = z.infer<typeof factCreateSchema>

// --- Entity Connection Graph ---
export const entityConnectionsSchema = z.object({
  depth: z.number().int().min(1).max(4).default(2),
  limit: z.number().int().min(1).max(200).default(50),
})

export type EntityConnectionsInput = z.infer<typeof entityConnectionsSchema>

// --- Pagination ---
export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  per_page: z.number().int().min(1).max(100).default(20),
})

export type PaginationInput = z.infer<typeof paginationSchema>

/**
 * Parse URL search params into an object for Zod validation.
 * Handles type coercion for numbers and booleans.
 */
export function parseSearchParams(url: URL): Record<string, unknown> {
  const params: Record<string, unknown> = {}
  for (const [key, value] of url.searchParams) {
    if (/^\d+$/.test(value)) {
      params[key] = parseInt(value, 10)
    } else if (value === 'true' || value === 'false') {
      params[key] = value === 'true'
    } else {
      params[key] = value
    }
  }
  return params
}
```

### Step 6: Create the auth callback route

File: `app/api/auth/callback/route.ts`

This is the OAuth callback handler. When a user signs in with Google/GitHub, Supabase redirects here with a `code` parameter. We exchange it for a session and create a user profile on first login.

```typescript
// app/api/auth/callback/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (!code) {
    console.error('[Auth Callback] No code parameter in callback URL')
    return NextResponse.redirect(`${origin}/login?error=no_code`)
  }

  const supabase = await createClient()

  // Exchange the code for a session
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('[Auth Callback] Code exchange failed:', error.message)
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  const user = data.user

  if (user) {
    // Check if user profile exists; create one on first login
    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('id', user.id)
      .single()

    if (!existingProfile) {
      const displayName =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split('@')[0] ||
        'Anonymous Researcher'

      const avatarUrl =
        user.user_metadata?.avatar_url ||
        user.user_metadata?.picture ||
        null

      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          id: user.id,
          display_name: displayName,
          avatar_url: avatarUrl,
          tier: 'contributor',
          xp: 0,
          level: 1,
          level_title: 'Observer',
        })

      if (profileError) {
        console.error('[Auth Callback] Failed to create user profile:', profileError.message)
        // Don't block login — profile can be created later
      }
    }
  }

  return NextResponse.redirect(`${origin}${next}`)
}
```

### Step 7: Create the search API route

File: `app/api/search/route.ts`

This is the primary hybrid search endpoint. It accepts a query with filters, calls the Supabase `hybrid_search_chunks_rrf` RPC function, and returns typed results. In a future phase, an embedding provider will generate the query embedding; for now, we do keyword-only search as a fallback.

```typescript
// app/api/search/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { searchRequestSchema, parseSearchParams } from '@/lib/api/schemas'
import { success, paginated, handleApiError } from '@/lib/api/responses'
import { checkRateLimit, getClientIP, RATE_LIMITS } from '@/lib/auth/rate-limit'
import { getUser } from '@/lib/auth/middleware'
import type { SearchResult } from '@/types/search'

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const user = await getUser()
    const identifier = user?.id || getClientIP(request)
    const rateLimitResponse = checkRateLimit(identifier, RATE_LIMITS.search)
    if (rateLimitResponse) return rateLimitResponse

    // Parse and validate request body
    const body = await request.json()
    const input = searchRequestSchema.parse(body)

    const supabase = await createClient()

    // All embeddings use Amazon Nova Multimodal Embeddings v1 (1024d).
    // When AWS Bedrock API keys are available, generate query embedding with Nova
    // and call hybrid_search_chunks_rrf with the 1024d query vector.
    // For now, fall back to keyword-only search.

    const offset = (input.page - 1) * input.per_page

    // Build the query
    let query = supabase
      .from('chunks')
      .select(
        `
        id,
        document_id,
        content,
        contextual_header,
        page_number,
        section_title,
        documents!inner (
          filename,
          classification,
          dataset_id,
          date_extracted,
          datasets ( name )
        )
      `,
        { count: 'exact' }
      )
      .textSearch('content_tsv', input.query, { type: 'websearch' })
      .range(offset, offset + input.per_page - 1)

    // Apply filters
    if (input.filters?.dataset_id) {
      query = query.eq('documents.dataset_id', input.filters.dataset_id)
    }
    if (input.filters?.doc_type) {
      query = query.eq('documents.classification', input.filters.doc_type)
    }
    if (input.filters?.date_from) {
      query = query.gte('documents.date_extracted', input.filters.date_from)
    }
    if (input.filters?.date_to) {
      query = query.lte('documents.date_extracted', input.filters.date_to)
    }

    const { data: chunks, count, error } = await query

    if (error) {
      console.error('[Search API] Query error:', error.message)
      throw new Error(`Search failed: ${error.message}`)
    }

    // Transform to SearchResult shape
    const results: SearchResult[] = (chunks || []).map((chunk: any) => ({
      chunk_id: chunk.id,
      document_id: chunk.document_id,
      content: chunk.content,
      contextual_header: chunk.contextual_header,
      page_number: chunk.page_number,
      section_title: chunk.section_title,
      document_filename: chunk.documents?.filename || '',
      document_classification: chunk.documents?.classification || null,
      dataset_name: chunk.documents?.datasets?.name || null,
      rrf_score: 0, // No RRF without embeddings yet
      semantic_rank: null,
      keyword_rank: null,
    }))

    return paginated(results, input.page, input.per_page, count || 0)
  } catch (err) {
    return handleApiError(err)
  }
}

// GET endpoint for URL-param-based search (for shareable links)
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const q = url.searchParams.get('q')

    if (!q) {
      return success([])
    }

    // Rate limiting
    const user = await getUser()
    const identifier = user?.id || getClientIP(request)
    const rateLimitResponse = checkRateLimit(identifier, RATE_LIMITS.search)
    if (rateLimitResponse) return rateLimitResponse

    const page = parseInt(url.searchParams.get('page') || '1', 10)
    const per_page = parseInt(url.searchParams.get('per_page') || '20', 10)

    const supabase = await createClient()
    const offset = (page - 1) * per_page

    const { data: chunks, count, error } = await supabase
      .from('chunks')
      .select(
        `
        id,
        document_id,
        content,
        contextual_header,
        page_number,
        section_title,
        documents!inner (
          filename,
          classification,
          datasets ( name )
        )
      `,
        { count: 'exact' }
      )
      .textSearch('content_tsv', q, { type: 'websearch' })
      .range(offset, offset + per_page - 1)

    if (error) {
      throw new Error(`Search failed: ${error.message}`)
    }

    const results: SearchResult[] = (chunks || []).map((chunk: any) => ({
      chunk_id: chunk.id,
      document_id: chunk.document_id,
      content: chunk.content,
      contextual_header: chunk.contextual_header,
      page_number: chunk.page_number,
      section_title: chunk.section_title,
      document_filename: chunk.documents?.filename || '',
      document_classification: chunk.documents?.classification || null,
      dataset_name: chunk.documents?.datasets?.name || null,
      rrf_score: 0,
      semantic_rank: null,
      keyword_rank: null,
    }))

    return paginated(results, page, per_page, count || 0)
  } catch (err) {
    return handleApiError(err)
  }
}
```

### Step 8: Create the multimodal search route

File: `app/api/search/multimodal/route.ts`

```typescript
// app/api/search/multimodal/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { multimodalSearchRequestSchema } from '@/lib/api/schemas'
import { paginated, handleApiError } from '@/lib/api/responses'
import { checkRateLimit, getClientIP, RATE_LIMITS } from '@/lib/auth/rate-limit'
import { getUser } from '@/lib/auth/middleware'
import type { MultimodalResult } from '@/types/search'

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const user = await getUser()
    const identifier = user?.id || getClientIP(request)
    const rateLimitResponse = checkRateLimit(identifier, RATE_LIMITS.search)
    if (rateLimitResponse) return rateLimitResponse

    const body = await request.json()
    const input = multimodalSearchRequestSchema.parse(body)

    const supabase = await createClient()

    // Multimodal search requires Nova 1024d embeddings (Phase 6).
    // With unified embeddings, one query vector searches all modalities natively.
    // For now, do text-only keyword search across chunks, images, and video_chunks.
    const results: MultimodalResult[] = []

    // Document search (keyword fallback)
    if (input.modalities.documents) {
      const { data: docResults } = await supabase
        .from('chunks')
        .select(
          `
          id,
          document_id,
          content,
          page_number,
          documents!inner (
            filename,
            datasets ( name )
          )
        `
        )
        .textSearch('content_tsv', input.query, { type: 'websearch' })
        .limit(input.per_page)

      if (docResults) {
        results.push(
          ...docResults.map((c: any) => ({
            result_id: c.id,
            source_type: 'document' as const,
            content: c.content,
            document_id: c.document_id,
            page_number: c.page_number,
            storage_path: null,
            filename: c.documents?.filename || null,
            dataset_name: c.documents?.datasets?.name || null,
            rrf_score: 0,
          }))
        )
      }
    }

    // Image search (description text match)
    if (input.modalities.images) {
      const { data: imgResults } = await supabase
        .from('images')
        .select(
          `
          id,
          document_id,
          description,
          ocr_text,
          page_number,
          storage_path,
          filename,
          datasets ( name )
        `
        )
        .or(`description.ilike.%${input.query}%,ocr_text.ilike.%${input.query}%`)
        .limit(input.per_page)

      if (imgResults) {
        results.push(
          ...imgResults.map((img: any) => ({
            result_id: img.id,
            source_type: 'image' as const,
            content: img.description || img.ocr_text || 'Image',
            document_id: img.document_id,
            page_number: img.page_number,
            storage_path: img.storage_path,
            filename: img.filename,
            dataset_name: img.datasets?.name || null,
            rrf_score: 0,
          }))
        )
      }
    }

    // Video search (transcript text search)
    if (input.modalities.videos) {
      const { data: vidResults } = await supabase
        .from('video_chunks')
        .select(
          `
          id,
          content,
          videos!inner (
            id,
            document_id,
            storage_path,
            filename,
            datasets ( name )
          )
        `
        )
        .textSearch('content_tsv', input.query, { type: 'websearch' })
        .limit(input.per_page)

      if (vidResults) {
        results.push(
          ...vidResults.map((vc: any) => ({
            result_id: vc.id,
            source_type: 'video' as const,
            content: vc.content,
            document_id: vc.videos?.document_id || null,
            page_number: null,
            storage_path: vc.videos?.storage_path || null,
            filename: vc.videos?.filename || null,
            dataset_name: vc.videos?.datasets?.name || null,
            rrf_score: 0,
          }))
        )
      }
    }

    // Sort by rrf_score (placeholder --- real scoring comes with embeddings)
    results.sort((a, b) => b.rrf_score - a.rrf_score)
    const paginatedResults = results.slice(0, input.per_page)

    return paginated(paginatedResults, input.page, input.per_page, results.length)
  } catch (err) {
    return handleApiError(err)
  }
}
```

### Step 8b: Create the stats API route

File: `app/api/stats/route.ts`

Returns enriched corpus stats from the `corpus_stats` materialized view, including community data counters.

```typescript
// app/api/stats/route.ts
import { createClient } from '@/lib/supabase/server'
import { success, handleApiError } from '@/lib/api/responses'

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: stats, error } = await supabase
      .from('corpus_stats')
      .select('*')
      .single()

    if (error) {
      // View may not be refreshed yet — return zeros
      return success({
        total_documents: 0,
        processed_documents: 0,
        community_ocr_documents: 0,
        total_pages: 0,
        total_chunks: 0,
        target_model_chunks: 0,
        community_model_chunks: 0,
        total_images: 0,
        total_videos: 0,
        total_entities: 0,
        community_entities: 0,
        total_relationships: 0,
        total_redactions: 0,
        solved_redactions: 0,
        corroborated_redactions: 0,
        total_proposals: 0,
        total_contributors: 0,
        total_flights: 0,
        sources_ingested: 0,
        sources_total: 0,
      })
    }

    return success(stats)
  } catch (err) {
    return handleApiError(err)
  }
}
```

### Step 8c: Create the sources API route

File: `app/api/sources/route.ts`

Returns all `data_sources` rows for the Sources status page.

```typescript
// app/api/sources/route.ts
import { createClient } from '@/lib/supabase/server'
import { success, handleApiError } from '@/lib/api/responses'

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: sources, error } = await supabase
      .from('data_sources')
      .select('id, name, source_type, url, data_type, status, expected_count, ingested_count, failed_count, error_message, priority, ingested_at')
      .order('priority', { ascending: false })
      .order('name', { ascending: true })

    if (error) {
      throw new Error(`Failed to fetch data sources: ${error.message}`)
    }

    return success(sources || [])
  } catch (err) {
    return handleApiError(err)
  }
}
```

### Step 9: Create entity detail route

File: `app/api/entity/[id]/route.ts`

```typescript
// app/api/entity/[id]/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, notFound, handleApiError } from '@/lib/api/responses'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Fetch entity with basic data
    const { data: entity, error } = await supabase
      .from('entities')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !entity) {
      return notFound('Entity not found')
    }

    // Fetch mention stats per document
    const { data: mentionStats } = await supabase.rpc('get_entity_mention_stats', {
      target_entity_id: id,
    })

    // Fetch top related entities (via relationships)
    const { data: relationships } = await supabase
      .from('entity_relationships')
      .select(
        `
        id,
        relationship_type,
        description,
        strength,
        entity_a_id,
        entity_b_id
      `
      )
      .or(`entity_a_id.eq.${id},entity_b_id.eq.${id}`)
      .order('strength', { ascending: false })
      .limit(10)

    // For each relationship, fetch the related entity name
    const relatedEntityIds = (relationships || []).map((r: any) =>
      r.entity_a_id === id ? r.entity_b_id : r.entity_a_id
    )

    let relatedEntities: any[] = []
    if (relatedEntityIds.length > 0) {
      const { data: entities } = await supabase
        .from('entities')
        .select('id, name, entity_type, mention_count')
        .in('id', relatedEntityIds)

      relatedEntities = entities || []
    }

    // Combine relationship data with entity names
    const relatedWithNames = (relationships || []).map((r: any) => {
      const relatedId = r.entity_a_id === id ? r.entity_b_id : r.entity_a_id
      const related = relatedEntities.find((e: any) => e.id === relatedId)
      return {
        relationship_id: r.id,
        relationship_type: r.relationship_type,
        description: r.description,
        strength: r.strength,
        entity: related || null,
      }
    })

    return success({
      ...entity,
      mention_stats: mentionStats || [],
      related_entities: relatedWithNames,
    })
  } catch (err) {
    return handleApiError(err)
  }
}
```

### Step 10: Create entity connections route (graph data)

File: `app/api/entity/[id]/connections/route.ts`

```typescript
// app/api/entity/[id]/connections/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { entityConnectionsSchema, parseSearchParams } from '@/lib/api/schemas'
import { success, notFound, handleApiError } from '@/lib/api/responses'
import type { EntityConnectionNode } from '@/types/entities'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const url = new URL(request.url)
    const queryParams = parseSearchParams(url)
    const input = entityConnectionsSchema.parse(queryParams)

    const supabase = await createClient()

    // Verify entity exists
    const { data: entity, error: entityError } = await supabase
      .from('entities')
      .select('id')
      .eq('id', id)
      .single()

    if (entityError || !entity) {
      return notFound('Entity not found')
    }

    // Fetch the connection graph via RPC
    const { data: graphData, error: graphError } = await supabase.rpc(
      'get_entity_connection_graph',
      {
        start_entity_id: id,
        max_depth: input.depth,
        max_nodes: input.limit,
      }
    )

    if (graphError) {
      throw new Error(`Graph query failed: ${graphError.message}`)
    }

    const nodes: EntityConnectionNode[] = graphData || []

    // Transform into nodes + edges format for the frontend graph renderer
    const uniqueNodes = nodes.map((n) => ({
      id: n.entity_id,
      name: n.entity_name,
      type: n.entity_type,
      mention_count: n.mention_count,
      depth: n.depth,
    }))

    const edges = nodes
      .filter((n) => n.connected_from !== null)
      .map((n) => ({
        source: n.connected_from,
        target: n.entity_id,
        relationship_type: n.relationship_type,
        strength: n.relationship_strength,
      }))

    return success({ nodes: uniqueNodes, edges })
  } catch (err) {
    return handleApiError(err)
  }
}
```

### Step 11: Create document detail route

File: `app/api/document/[id]/route.ts`

```typescript
// app/api/document/[id]/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, notFound, handleApiError } from '@/lib/api/responses'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1', 10)
    const per_page = parseInt(url.searchParams.get('per_page') || '50', 10)

    const supabase = await createClient()

    // Fetch document metadata
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select(
        `
        *,
        datasets ( id, name, dataset_number )
      `
      )
      .eq('id', id)
      .single()

    if (docError || !document) {
      return notFound('Document not found')
    }

    // Fetch paginated chunks
    const offset = (page - 1) * per_page
    const { data: chunks, count: chunkCount } = await supabase
      .from('chunks')
      .select('id, chunk_index, content, contextual_header, page_number, section_title', {
        count: 'exact',
      })
      .eq('document_id', id)
      .order('chunk_index', { ascending: true })
      .range(offset, offset + per_page - 1)

    // Fetch redactions for this document
    const { data: redactions } = await supabase
      .from('redactions')
      .select(
        `
        id,
        page_number,
        redaction_type,
        char_length_estimate,
        surrounding_text,
        sentence_template,
        status,
        resolved_text,
        confidence,
        potential_cascade_count
      `
      )
      .eq('document_id', id)
      .order('page_number', { ascending: true })

    // Fetch entity mentions for this document
    const { data: mentions } = await supabase
      .from('entity_mentions')
      .select(
        `
        id,
        entity_id,
        mention_text,
        context_snippet,
        mention_type,
        page_number,
        entities ( id, name, entity_type )
      `
      )
      .eq('document_id', id)
      .limit(200)

    return success({
      document,
      chunks: chunks || [],
      chunk_pagination: {
        page,
        per_page,
        total: chunkCount || 0,
        has_more: page * per_page < (chunkCount || 0),
      },
      redactions: redactions || [],
      mentions: mentions || [],
    })
  } catch (err) {
    return handleApiError(err)
  }
}
```

### Step 12: Create similar documents route

File: `app/api/document/[id]/similar/route.ts`

```typescript
// app/api/document/[id]/similar/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, handleApiError } from '@/lib/api/responses'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') || '10', 10)

    const supabase = await createClient()

    // Get the first chunk embedding for this document to use as query vector
    const { data: sourceChunk, error: chunkError } = await supabase
      .from('chunks')
      .select('content_embedding')
      .eq('document_id', id)
      .not('content_embedding', 'is', null)
      .order('chunk_index', { ascending: true })
      .limit(1)
      .single()

    if (chunkError || !sourceChunk?.content_embedding) {
      // No embeddings available --- return empty array.
      // This is expected before Phase 5 generates embeddings.
      return success([])
    }

    // Use the embedding to find similar chunks from OTHER documents
    const { data: similarChunks, error: searchError } = await supabase.rpc(
      'hybrid_search_chunks_rrf',
      {
        query_text: '',
        query_embedding: sourceChunk.content_embedding,
        match_count: limit * 3,
      }
    )

    if (searchError) {
      throw new Error(`Similar search failed: ${searchError.message}`)
    }

    // Deduplicate by document_id, exclude the source document
    const seenDocIds = new Set<string>([id])
    const uniqueResults: any[] = []

    for (const chunk of similarChunks || []) {
      if (seenDocIds.has(chunk.document_id)) continue
      seenDocIds.add(chunk.document_id)
      uniqueResults.push({
        document_id: chunk.document_id,
        document_filename: chunk.document_filename,
        document_classification: chunk.document_classification,
        dataset_name: chunk.dataset_name,
        preview_content: chunk.content.slice(0, 300),
        similarity_score: chunk.rrf_score,
      })
      if (uniqueResults.length >= limit) break
    }

    return success(uniqueResults)
  } catch (err) {
    return handleApiError(err)
  }
}
```

### Step 13: Create timeline events route

File: `app/api/timeline/route.ts`

```typescript
// app/api/timeline/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { timelineQuerySchema, parseSearchParams } from '@/lib/api/schemas'
import { paginated, handleApiError } from '@/lib/api/responses'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const queryParams = parseSearchParams(url)
    const input = timelineQuerySchema.parse(queryParams)

    const supabase = await createClient()
    const offset = (input.page - 1) * input.per_page

    let query = supabase
      .from('timeline_events')
      .select('*', { count: 'exact' })
      .order('event_date', { ascending: true, nullsFirst: false })
      .range(offset, offset + input.per_page - 1)

    if (input.entity_id) {
      query = query.contains('entity_ids', [input.entity_id])
    }
    if (input.date_from) {
      query = query.gte('event_date', input.date_from)
    }
    if (input.date_to) {
      query = query.lte('event_date', input.date_to)
    }
    if (input.event_type) {
      query = query.eq('event_type', input.event_type)
    }

    const { data: events, count, error } = await query

    if (error) {
      throw new Error(`Timeline query failed: ${error.message}`)
    }

    return paginated(events || [], input.page, input.per_page, count || 0)
  } catch (err) {
    return handleApiError(err)
  }
}
```

### Step 14: Create redaction proposal route

File: `app/api/redaction/[id]/propose/route.ts`

```typescript
// app/api/redaction/[id]/propose/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { proposalRequestSchema } from '@/lib/api/schemas'
import { success, notFound, handleApiError } from '@/lib/api/responses'
import { requireAuth } from '@/lib/auth/middleware'
import { checkRateLimit, RATE_LIMITS } from '@/lib/auth/rate-limit'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // Auth required
    const userOrResponse = await requireAuth()
    if (userOrResponse instanceof Response) return userOrResponse
    const user = userOrResponse

    // Rate limiting
    const rateLimitResponse = checkRateLimit(user.id, RATE_LIMITS.proposal)
    if (rateLimitResponse) return rateLimitResponse

    const { id: redactionId } = await params
    const body = await request.json()
    const input = proposalRequestSchema.parse(body)

    const supabase = await createClient()

    // Verify the redaction exists
    const { data: redaction, error: redactionError } = await supabase
      .from('redactions')
      .select('id, status, char_length_estimate')
      .eq('id', redactionId)
      .single()

    if (redactionError || !redaction) {
      return notFound('Redaction not found')
    }

    // Check if the proposed text matches the expected character length
    const lengthMatch =
      redaction.char_length_estimate !== null
        ? Math.abs(input.proposed_text.length - (redaction.char_length_estimate as number)) <= 3
        : null

    // Insert the proposal
    const { data: proposal, error: insertError } = await supabase
      .from('redaction_proposals')
      .insert({
        redaction_id: redactionId,
        user_id: user.id,
        proposed_text: input.proposed_text,
        proposed_entity_id: input.proposed_entity_id || null,
        evidence_type: input.evidence_type,
        evidence_description: input.evidence_description,
        evidence_sources: input.evidence_sources,
        supporting_chunk_ids: input.supporting_chunk_ids,
        length_match: lengthMatch,
        status: 'pending',
      })
      .select()
      .single()

    if (insertError) {
      throw new Error(`Failed to create proposal: ${insertError.message}`)
    }

    // Update the redaction status to 'proposed' if it was 'unsolved'
    if (redaction.status === 'unsolved') {
      await supabase
        .from('redactions')
        .update({ status: 'proposed', updated_at: new Date().toISOString() })
        .eq('id', redactionId)
    }

    // Calculate the composite confidence score
    await supabase.rpc('calculate_proposal_confidence', {
      target_proposal_id: proposal.id,
    })

    // Re-fetch the proposal with the computed confidence
    const { data: updatedProposal } = await supabase
      .from('redaction_proposals')
      .select('*')
      .eq('id', proposal.id)
      .single()

    return success(updatedProposal || proposal)
  } catch (err) {
    return handleApiError(err)
  }
}
```

### Step 15: Create redaction vote route

File: `app/api/redaction/[id]/vote/route.ts`

```typescript
// app/api/redaction/[id]/vote/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { voteRequestSchema } from '@/lib/api/schemas'
import { success, notFound, error, handleApiError } from '@/lib/api/responses'
import { requireAuth } from '@/lib/auth/middleware'
import { checkRateLimit, RATE_LIMITS } from '@/lib/auth/rate-limit'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // Auth required
    const userOrResponse = await requireAuth()
    if (userOrResponse instanceof Response) return userOrResponse
    const user = userOrResponse

    // Rate limiting
    const rateLimitResponse = checkRateLimit(user.id, RATE_LIMITS.vote)
    if (rateLimitResponse) return rateLimitResponse

    const { id: redactionId } = await params
    const body = await request.json()
    const input = voteRequestSchema.parse(body)

    const supabase = await createClient()

    // Verify the proposal exists and belongs to this redaction
    const { data: proposal, error: proposalError } = await supabase
      .from('redaction_proposals')
      .select('id, redaction_id, user_id, upvotes, downvotes, corroborations')
      .eq('id', input.proposal_id)
      .eq('redaction_id', redactionId)
      .single()

    if (proposalError || !proposal) {
      return notFound('Proposal not found for this redaction')
    }

    // Prevent self-voting
    if (proposal.user_id === user.id) {
      return error('Cannot vote on your own proposal', 400)
    }

    // Upsert the vote (unique constraint on proposal_id + user_id)
    const { data: vote, error: voteError } = await supabase
      .from('proposal_votes')
      .upsert(
        {
          proposal_id: input.proposal_id,
          user_id: user.id,
          vote_type: input.vote_type,
        },
        { onConflict: 'proposal_id,user_id' }
      )
      .select()
      .single()

    if (voteError) {
      throw new Error(`Failed to cast vote: ${voteError.message}`)
    }

    // Recalculate vote totals on the proposal
    const { data: voteCounts } = await supabase
      .from('proposal_votes')
      .select('vote_type')
      .eq('proposal_id', input.proposal_id)

    const upvotes = (voteCounts || []).filter((v: any) => v.vote_type === 'upvote').length
    const downvotes = (voteCounts || []).filter((v: any) => v.vote_type === 'downvote').length
    const corroborations = (voteCounts || []).filter((v: any) => v.vote_type === 'corroborate').length

    await supabase
      .from('redaction_proposals')
      .update({ upvotes, downvotes, corroborations })
      .eq('id', input.proposal_id)

    // Recalculate composite confidence
    await supabase.rpc('calculate_proposal_confidence', {
      target_proposal_id: input.proposal_id,
    })

    // If corroborations >= 3, update redaction status to 'corroborated'
    if (corroborations >= 3) {
      await supabase
        .from('redactions')
        .update({ status: 'corroborated', updated_at: new Date().toISOString() })
        .eq('id', redactionId)
        .in('status', ['unsolved', 'proposed'])
    }

    return success({
      vote,
      proposal_votes: { upvotes, downvotes, corroborations },
    })
  } catch (err) {
    return handleApiError(err)
  }
}
```

### Step 16: Create redactions dashboard route

File: `app/api/redactions/dashboard/route.ts`

```typescript
// app/api/redactions/dashboard/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, handleApiError } from '@/lib/api/responses'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get redaction statistics
    const { data: stats, error: statsError } = await supabase.rpc('get_redaction_stats')

    if (statsError) {
      throw new Error(`Failed to get redaction stats: ${statsError.message}`)
    }

    // Get top contributors (by proposals confirmed)
    const { data: topContributors } = await supabase
      .from('user_profiles')
      .select('id, display_name, avatar_url, proposals_submitted, proposals_confirmed, cascades_triggered, reputation_score, level, level_title')
      .order('proposals_confirmed', { ascending: false })
      .limit(10)

    // Get recent solves
    const { data: recentSolves } = await supabase
      .from('redactions')
      .select(
        `
        id,
        resolved_text,
        resolved_at,
        cascade_count,
        documents ( filename ),
        page_number
      `
      )
      .eq('status', 'confirmed')
      .order('resolved_at', { ascending: false })
      .limit(10)

    return success({
      stats: stats?.[0] || null,
      top_contributors: topContributors || [],
      recent_solves: recentSolves || [],
    })
  } catch (err) {
    return handleApiError(err)
  }
}
```

### Step 17: Create solvable redactions feed

File: `app/api/redactions/solvable/route.ts`

```typescript
// app/api/redactions/solvable/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { paginationSchema, parseSearchParams } from '@/lib/api/schemas'
import { paginated, handleApiError } from '@/lib/api/responses'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const queryParams = parseSearchParams(url)
    const input = paginationSchema.parse(queryParams)

    const typeFilter = url.searchParams.get('type') || null
    const datasetFilter = url.searchParams.get('dataset_id') || null

    const supabase = await createClient()

    const { data: solvable, error } = await supabase.rpc('get_solvable_redactions', {
      limit_count: input.per_page,
      offset_count: (input.page - 1) * input.per_page,
      status_filter: 'unsolved',
      type_filter: typeFilter,
      dataset_filter: datasetFilter,
    })

    if (error) {
      throw new Error(`Solvable redactions query failed: ${error.message}`)
    }

    // Get total count for pagination
    const { count } = await supabase
      .from('redactions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'unsolved')

    return paginated(solvable || [], input.page, input.per_page, count || 0)
  } catch (err) {
    return handleApiError(err)
  }
}
```

### Step 18: Create stats route

File: `app/api/stats/route.ts`

```typescript
// app/api/stats/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, handleApiError } from '@/lib/api/responses'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Try the materialized view first
    const { data: stats, error } = await supabase
      .from('corpus_stats')
      .select('*')
      .limit(1)
      .single()

    if (error) {
      // Materialized view might not be refreshed yet.
      // Fall back to live counts (slower but always accurate).
      const [
        { count: docCount },
        { count: processedCount },
        { count: chunkCount },
        { count: imageCount },
        { count: videoCount },
        { count: entityCount },
        { count: relationshipCount },
        { count: redactionCount },
        { count: solvedCount },
      ] = await Promise.all([
        supabase.from('documents').select('id', { count: 'exact', head: true }),
        supabase.from('documents').select('id', { count: 'exact', head: true }).eq('processing_status', 'complete'),
        supabase.from('chunks').select('id', { count: 'exact', head: true }),
        supabase.from('images').select('id', { count: 'exact', head: true }),
        supabase.from('videos').select('id', { count: 'exact', head: true }),
        supabase.from('entities').select('id', { count: 'exact', head: true }),
        supabase.from('entity_relationships').select('id', { count: 'exact', head: true }),
        supabase.from('redactions').select('id', { count: 'exact', head: true }),
        supabase.from('redactions').select('id', { count: 'exact', head: true }).eq('status', 'confirmed'),
      ])

      return success({
        total_documents: docCount || 0,
        processed_documents: processedCount || 0,
        total_pages: null,
        total_chunks: chunkCount || 0,
        total_images: imageCount || 0,
        total_videos: videoCount || 0,
        total_entities: entityCount || 0,
        total_relationships: relationshipCount || 0,
        total_redactions: redactionCount || 0,
        solved_redactions: solvedCount || 0,
        corroborated_redactions: 0,
        total_proposals: 0,
        total_contributors: 0,
      })
    }

    return success(stats)
  } catch (err) {
    return handleApiError(err)
  }
}
```

### Step 19: Create random document route

File: `app/api/random-document/route.ts`

```typescript
// app/api/random-document/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, notFound, handleApiError } from '@/lib/api/responses'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const dataset = url.searchParams.get('dataset_id')
    const docType = url.searchParams.get('doc_type')

    const supabase = await createClient()

    // Count eligible documents
    let countQuery = supabase
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('processing_status', 'complete')

    if (dataset) countQuery = countQuery.eq('dataset_id', dataset)
    if (docType) countQuery = countQuery.eq('classification', docType)

    const { count } = await countQuery

    if (!count || count === 0) {
      return notFound('No processed documents available')
    }

    // Pick a random offset
    const randomOffset = Math.floor(Math.random() * count)

    let docQuery = supabase
      .from('documents')
      .select('id, filename, classification, page_count')
      .eq('processing_status', 'complete')

    if (dataset) docQuery = docQuery.eq('dataset_id', dataset)
    if (docType) docQuery = docQuery.eq('classification', docType)

    const { data: documents, error } = await docQuery
      .range(randomOffset, randomOffset)
      .limit(1)

    if (error || !documents || documents.length === 0) {
      return notFound('No documents found')
    }

    return success(documents[0])
  } catch (err) {
    return handleApiError(err)
  }
}
```

### Step 20: Create discoveries feed route

File: `app/api/discoveries/route.ts`

```typescript
// app/api/discoveries/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { paginationSchema, parseSearchParams } from '@/lib/api/schemas'
import { paginated, handleApiError } from '@/lib/api/responses'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const queryParams = parseSearchParams(url)
    const input = paginationSchema.parse(queryParams)
    const typeFilter = url.searchParams.get('type')

    const supabase = await createClient()
    const offset = (input.page - 1) * input.per_page

    // Discoveries are composed from multiple sources:
    // 1. Recent confirmed redaction solves
    // 2. Recently verified entity relationships
    const discoveries: any[] = []

    // Redaction solves
    if (!typeFilter || typeFilter === 'redaction_solved') {
      const { data: solves } = await supabase
        .from('redactions')
        .select(
          `
          id,
          resolved_text,
          surrounding_text,
          resolved_at,
          cascade_count,
          document_id,
          page_number,
          documents ( filename )
        `
        )
        .eq('status', 'confirmed')
        .not('resolved_at', 'is', null)
        .order('resolved_at', { ascending: false })
        .range(offset, offset + input.per_page - 1)

      if (solves) {
        discoveries.push(
          ...solves.map((s: any) => ({
            id: s.id,
            type: 'redaction_solved' as const,
            title: `Redaction Solved: "${s.resolved_text}"`,
            description: `The redacted text in ${s.documents?.filename || 'a document'} (page ${s.page_number || '?'}) has been identified.`,
            user_display_name: null,
            cascade_count: s.cascade_count || 0,
            created_at: s.resolved_at,
          }))
        )
      }
    }

    // Sort by date
    discoveries.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    const { count } = await supabase
      .from('redactions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'confirmed')

    return paginated(
      discoveries.slice(0, input.per_page),
      input.page,
      input.per_page,
      count || 0
    )
  } catch (err) {
    return handleApiError(err)
  }
}
```

### Step 21: Create "Today in History" route

File: `app/api/discoveries/today-in-history/route.ts`

```typescript
// app/api/discoveries/today-in-history/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, handleApiError } from '@/lib/api/responses'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const today = new Date()
    const month = today.getMonth() + 1
    const day = today.getDate()

    // Find documents with extracted dates matching today's month and day.
    // We fetch recent dated documents and filter in JS since
    // Supabase JS client doesn't support EXTRACT(). In production,
    // use an RPC function for server-side filtering.
    const { data: documents, error } = await supabase
      .from('documents')
      .select('id, filename, classification, date_extracted, page_count')
      .not('date_extracted', 'is', null)
      .limit(500)

    if (error) {
      throw new Error(`Today in history query failed: ${error.message}`)
    }

    // Filter for month/day match
    const matches = (documents || []).filter((doc: any) => {
      if (!doc.date_extracted) return false
      const docDate = new Date(doc.date_extracted)
      return docDate.getMonth() + 1 === month && docDate.getDate() === day
    })

    return success(
      matches.map((doc: any) => ({
        id: doc.id,
        filename: doc.filename,
        classification: doc.classification,
        date: doc.date_extracted,
        page_count: doc.page_count,
      }))
    )
  } catch (err) {
    return handleApiError(err)
  }
}
```

### Step 22: Create entity dossier route

File: `app/api/entity/[id]/dossier/route.ts`

```typescript
// app/api/entity/[id]/dossier/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, notFound, handleApiError } from '@/lib/api/responses'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Fetch entity
    const { data: entity, error: entityError } = await supabase
      .from('entities')
      .select('*')
      .eq('id', id)
      .single()

    if (entityError || !entity) {
      return notFound('Entity not found')
    }

    // Fetch all document mentions grouped by document
    const { data: mentionStats } = await supabase.rpc('get_entity_mention_stats', {
      target_entity_id: id,
    })

    // Fetch all relationships
    const { data: relationships } = await supabase
      .from('entity_relationships')
      .select(
        `
        id,
        relationship_type,
        description,
        strength,
        is_verified,
        entity_a_id,
        entity_b_id
      `
      )
      .or(`entity_a_id.eq.${id},entity_b_id.eq.${id}`)
      .order('strength', { ascending: false })

    // Fetch related entity names
    const relatedIds = (relationships || []).map((r: any) =>
      r.entity_a_id === id ? r.entity_b_id : r.entity_a_id
    )

    let relatedEntities: any[] = []
    if (relatedIds.length > 0) {
      const { data } = await supabase
        .from('entities')
        .select('id, name, entity_type')
        .in('id', relatedIds)
      relatedEntities = data || []
    }

    // Fetch timeline events involving this entity
    const { data: timelineEvents } = await supabase
      .from('timeline_events')
      .select('*')
      .contains('entity_ids', [id])
      .order('event_date', { ascending: true })
      .limit(100)

    // Compile dossier sections
    const dossier = {
      entity: {
        name: entity.name,
        type: entity.entity_type,
        aliases: entity.aliases,
        description: entity.description,
        first_seen: entity.first_seen_date,
        last_seen: entity.last_seen_date,
        total_mentions: entity.mention_count,
        total_documents: entity.document_count,
      },
      involvement_summary: {
        document_appearances: mentionStats || [],
        total_documents: (mentionStats || []).length,
        total_mentions: entity.mention_count,
      },
      relationship_map: (relationships || []).map((r: any) => {
        const relatedId = r.entity_a_id === id ? r.entity_b_id : r.entity_a_id
        const related = relatedEntities.find((e: any) => e.id === relatedId)
        return {
          relationship_type: r.relationship_type,
          description: r.description,
          strength: r.strength,
          is_verified: r.is_verified,
          connected_entity: related
            ? { id: related.id, name: related.name, type: related.entity_type }
            : null,
        }
      }),
      timeline: (timelineEvents || []).map((e: any) => ({
        date: e.event_date,
        date_display: e.date_display,
        description: e.description,
        event_type: e.event_type,
        location: e.location,
        is_verified: e.is_verified,
      })),
      generated_at: new Date().toISOString(),
    }

    return success(dossier)
  } catch (err) {
    return handleApiError(err)
  }
}
```

### Step 23: Create annotations route

File: `app/api/annotations/route.ts`

```typescript
// app/api/annotations/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { annotationRequestSchema, parseSearchParams, paginationSchema } from '@/lib/api/schemas'
import { success, paginated, handleApiError } from '@/lib/api/responses'
import { requireAuth, getUser } from '@/lib/auth/middleware'
import { checkRateLimit, RATE_LIMITS } from '@/lib/auth/rate-limit'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const documentId = url.searchParams.get('document_id')
    const chunkId = url.searchParams.get('chunk_id')
    const queryParams = parseSearchParams(url)
    const pagination = paginationSchema.parse(queryParams)

    const supabase = await createClient()
    const offset = (pagination.page - 1) * pagination.per_page

    let query = supabase
      .from('annotations')
      .select(
        `
        *,
        user_profiles ( display_name, avatar_url )
      `,
        { count: 'exact' }
      )
      .is('parent_id', null) // Only top-level annotations
      .order('created_at', { ascending: false })
      .range(offset, offset + pagination.per_page - 1)

    if (documentId) {
      query = query.eq('document_id', documentId)
    }
    if (chunkId) {
      query = query.eq('chunk_id', chunkId)
    }

    const { data: annotations, count, error } = await query

    if (error) {
      throw new Error(`Annotations query failed: ${error.message}`)
    }

    // Fetch replies for each annotation
    const annotationIds = (annotations || []).map((a: any) => a.id)
    let replies: any[] = []

    if (annotationIds.length > 0) {
      const { data: replyData } = await supabase
        .from('annotations')
        .select(
          `
          *,
          user_profiles ( display_name, avatar_url )
        `
        )
        .in('parent_id', annotationIds)
        .order('created_at', { ascending: true })

      replies = replyData || []
    }

    // Attach replies to their parent annotations
    const annotationsWithReplies = (annotations || []).map((a: any) => ({
      ...a,
      user_display_name: a.user_profiles?.display_name,
      user_avatar_url: a.user_profiles?.avatar_url,
      replies: replies
        .filter((r: any) => r.parent_id === a.id)
        .map((r: any) => ({
          ...r,
          user_display_name: r.user_profiles?.display_name,
          user_avatar_url: r.user_profiles?.avatar_url,
        })),
    }))

    return paginated(annotationsWithReplies, pagination.page, pagination.per_page, count || 0)
  } catch (err) {
    return handleApiError(err)
  }
}

export async function POST(request: NextRequest) {
  try {
    // Auth required
    const userOrResponse = await requireAuth()
    if (userOrResponse instanceof Response) return userOrResponse
    const user = userOrResponse

    // Rate limiting
    const rateLimitResponse = checkRateLimit(user.id, RATE_LIMITS.annotation)
    if (rateLimitResponse) return rateLimitResponse

    const body = await request.json()
    const input = annotationRequestSchema.parse(body)

    const supabase = await createClient()

    const { data: annotation, error } = await supabase
      .from('annotations')
      .insert({
        user_id: user.id,
        document_id: input.document_id,
        chunk_id: input.chunk_id || null,
        page_number: input.page_number || null,
        content: input.content,
        annotation_type: input.annotation_type,
        parent_id: input.parent_id || null,
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create annotation: ${error.message}`)
    }

    return success(annotation)
  } catch (err) {
    return handleApiError(err)
  }
}
```

### Step 24: Create annotation vote route

File: `app/api/annotations/[id]/vote/route.ts`

```typescript
// app/api/annotations/[id]/vote/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, notFound, error, handleApiError } from '@/lib/api/responses'
import { requireAuth } from '@/lib/auth/middleware'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const userOrResponse = await requireAuth()
    if (userOrResponse instanceof Response) return userOrResponse
    const user = userOrResponse

    const { id: annotationId } = await params
    const body = await request.json()
    const voteType = body.vote_type as 'upvote' | 'downvote'

    if (!voteType || !['upvote', 'downvote'].includes(voteType)) {
      return error('vote_type must be "upvote" or "downvote"', 400)
    }

    const supabase = await createClient()

    // Verify annotation exists
    const { data: annotation, error: annotationError } = await supabase
      .from('annotations')
      .select('id, user_id, upvotes, downvotes')
      .eq('id', annotationId)
      .single()

    if (annotationError || !annotation) {
      return notFound('Annotation not found')
    }

    // Prevent self-voting
    if (annotation.user_id === user.id) {
      return error('Cannot vote on your own annotation', 400)
    }

    // Update vote count directly (simplified --- a proper implementation
    // would track individual votes in a separate table)
    const updateField = voteType === 'upvote' ? 'upvotes' : 'downvotes'
    const currentCount = voteType === 'upvote' ? annotation.upvotes : annotation.downvotes

    const { data: updated, error: updateError } = await supabase
      .from('annotations')
      .update({ [updateField]: (currentCount || 0) + 1 })
      .eq('id', annotationId)
      .select()
      .single()

    if (updateError) {
      throw new Error(`Failed to update vote: ${updateError.message}`)
    }

    return success(updated)
  } catch (err) {
    return handleApiError(err)
  }
}
```

### Step 25: Create investigation threads routes

File: `app/api/investigation-threads/route.ts`

```typescript
// app/api/investigation-threads/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { threadCreateSchema, paginationSchema, parseSearchParams } from '@/lib/api/schemas'
import { success, paginated, handleApiError } from '@/lib/api/responses'
import { requireAuth } from '@/lib/auth/middleware'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const queryParams = parseSearchParams(url)
    const pagination = paginationSchema.parse(queryParams)
    const status = url.searchParams.get('status') || 'active'
    const tag = url.searchParams.get('tag')

    const supabase = await createClient()
    const offset = (pagination.page - 1) * pagination.per_page

    let query = supabase
      .from('investigation_threads')
      .select(
        `
        *,
        user_profiles ( display_name, avatar_url )
      `,
        { count: 'exact' }
      )
      .eq('is_public', true)
      .eq('status', status)
      .order('updated_at', { ascending: false })
      .range(offset, offset + pagination.per_page - 1)

    if (tag) {
      query = query.contains('tags', [tag])
    }

    const { data: threads, count, error } = await query

    if (error) {
      throw new Error(`Threads query failed: ${error.message}`)
    }

    const threadsWithMeta = (threads || []).map((t: any) => ({
      ...t,
      user_display_name: t.user_profiles?.display_name,
      user_avatar_url: t.user_profiles?.avatar_url,
    }))

    return paginated(threadsWithMeta, pagination.page, pagination.per_page, count || 0)
  } catch (err) {
    return handleApiError(err)
  }
}

export async function POST(request: NextRequest) {
  try {
    const userOrResponse = await requireAuth()
    if (userOrResponse instanceof Response) return userOrResponse
    const user = userOrResponse

    const body = await request.json()
    const input = threadCreateSchema.parse(body)

    const supabase = await createClient()

    const { data: thread, error } = await supabase
      .from('investigation_threads')
      .insert({
        user_id: user.id,
        title: input.title,
        description: input.description || null,
        is_public: input.is_public,
        tags: input.tags,
        status: 'active',
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create thread: ${error.message}`)
    }

    return success(thread)
  } catch (err) {
    return handleApiError(err)
  }
}
```

File: `app/api/investigation-threads/[id]/route.ts`

```typescript
// app/api/investigation-threads/[id]/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { threadItemSchema } from '@/lib/api/schemas'
import { success, notFound, forbidden, handleApiError } from '@/lib/api/responses'
import { requireAuth, getUser } from '@/lib/auth/middleware'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: thread, error } = await supabase
      .from('investigation_threads')
      .select(
        `
        *,
        user_profiles ( display_name, avatar_url )
      `
      )
      .eq('id', id)
      .single()

    if (error || !thread) {
      return notFound('Thread not found')
    }

    // Check access for private threads
    if (!thread.is_public) {
      const user = await getUser()
      if (!user || user.id !== thread.user_id) {
        return notFound('Thread not found')
      }
    }

    // Fetch thread items
    const { data: items } = await supabase
      .from('investigation_thread_items')
      .select(
        `
        *,
        user_profiles ( display_name, avatar_url )
      `
      )
      .eq('thread_id', id)
      .order('position', { ascending: true })

    return success({
      ...thread,
      user_display_name: (thread as any).user_profiles?.display_name,
      user_avatar_url: (thread as any).user_profiles?.avatar_url,
      items: items || [],
    })
  } catch (err) {
    return handleApiError(err)
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const userOrResponse = await requireAuth()
    if (userOrResponse instanceof Response) return userOrResponse
    const user = userOrResponse

    const { id } = await params
    const body = await request.json()

    const supabase = await createClient()

    // Verify ownership
    const { data: thread } = await supabase
      .from('investigation_threads')
      .select('user_id')
      .eq('id', id)
      .single()

    if (!thread || thread.user_id !== user.id) {
      return forbidden('Only the thread owner can update it')
    }

    const { data: updated, error } = await supabase
      .from('investigation_threads')
      .update({
        ...(body.title && { title: body.title }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.status && { status: body.status }),
        ...(body.conclusion_summary !== undefined && { conclusion_summary: body.conclusion_summary }),
        ...(body.tags && { tags: body.tags }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update thread: ${error.message}`)
    }

    return success(updated)
  } catch (err) {
    return handleApiError(err)
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const userOrResponse = await requireAuth()
    if (userOrResponse instanceof Response) return userOrResponse
    const user = userOrResponse

    const { id } = await params
    const body = await request.json()
    const input = threadItemSchema.parse(body)

    const supabase = await createClient()

    // Verify thread exists and user is owner or follower
    const { data: thread } = await supabase
      .from('investigation_threads')
      .select('user_id')
      .eq('id', id)
      .single()

    if (!thread) {
      return notFound('Thread not found')
    }

    // Get the next position
    const { count } = await supabase
      .from('investigation_thread_items')
      .select('id', { count: 'exact', head: true })
      .eq('thread_id', id)

    const { data: item, error } = await supabase
      .from('investigation_thread_items')
      .insert({
        thread_id: id,
        user_id: user.id,
        item_type: input.item_type,
        target_id: input.target_id || null,
        note: input.note || null,
        position: (count || 0) + 1,
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to add thread item: ${error.message}`)
    }

    // Update thread timestamp
    await supabase
      .from('investigation_threads')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', id)

    return success(item)
  } catch (err) {
    return handleApiError(err)
  }
}
```

### Step 26: Create OCR corrections route

File: `app/api/ocr-corrections/route.ts`

```typescript
// app/api/ocr-corrections/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ocrCorrectionSchema, paginationSchema, parseSearchParams } from '@/lib/api/schemas'
import { success, paginated, handleApiError } from '@/lib/api/responses'
import { requireAuth } from '@/lib/auth/middleware'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const documentId = url.searchParams.get('document_id')
    const queryParams = parseSearchParams(url)
    const pagination = paginationSchema.parse(queryParams)

    const supabase = await createClient()
    const offset = (pagination.page - 1) * pagination.per_page

    let query = supabase
      .from('ocr_corrections')
      .select(
        `
        *,
        user_profiles ( display_name, avatar_url )
      `,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + pagination.per_page - 1)

    if (documentId) {
      query = query.eq('document_id', documentId)
    }

    const { data: corrections, count, error } = await query

    if (error) {
      throw new Error(`OCR corrections query failed: ${error.message}`)
    }

    return paginated(corrections || [], pagination.page, pagination.per_page, count || 0)
  } catch (err) {
    return handleApiError(err)
  }
}

export async function POST(request: NextRequest) {
  try {
    const userOrResponse = await requireAuth()
    if (userOrResponse instanceof Response) return userOrResponse
    const user = userOrResponse

    const body = await request.json()
    const input = ocrCorrectionSchema.parse(body)

    const supabase = await createClient()

    const { data: correction, error } = await supabase
      .from('ocr_corrections')
      .insert({
        user_id: user.id,
        document_id: input.document_id,
        chunk_id: input.chunk_id || null,
        page_number: input.page_number || null,
        original_text: input.original_text,
        corrected_text: input.corrected_text,
        status: 'pending',
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to submit OCR correction: ${error.message}`)
    }

    return success(correction)
  } catch (err) {
    return handleApiError(err)
  }
}
```

### Step 27: Create notifications route

File: `app/api/notifications/route.ts`

```typescript
// app/api/notifications/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { paginationSchema, parseSearchParams } from '@/lib/api/schemas'
import { success, paginated, handleApiError } from '@/lib/api/responses'
import { requireAuth } from '@/lib/auth/middleware'

export async function GET(request: NextRequest) {
  try {
    const userOrResponse = await requireAuth()
    if (userOrResponse instanceof Response) return userOrResponse
    const user = userOrResponse

    const url = new URL(request.url)
    const queryParams = parseSearchParams(url)
    const pagination = paginationSchema.parse(queryParams)

    const supabase = await createClient()
    const offset = (pagination.page - 1) * pagination.per_page

    // Get notifications for this user
    const { data: notifications, count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + pagination.per_page - 1)

    if (error) {
      throw new Error(`Notifications query failed: ${error.message}`)
    }

    // Get unread count
    const { count: unreadCount } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false)

    return paginated(notifications || [], pagination.page, pagination.per_page, count || 0)
  } catch (err) {
    return handleApiError(err)
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userOrResponse = await requireAuth()
    if (userOrResponse instanceof Response) return userOrResponse
    const user = userOrResponse

    const body = await request.json()
    const notificationIds = body.notification_ids as string[]
    const markAll = body.mark_all as boolean

    const supabase = await createClient()

    if (markAll) {
      // Mark all as read
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false)
    } else if (notificationIds && notificationIds.length > 0) {
      // Mark specific notifications as read
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .in('id', notificationIds)
    }

    return success({ marked_read: true })
  } catch (err) {
    return handleApiError(err)
  }
}
```

### Step 28: Create bounties route

File: `app/api/bounties/route.ts`

```typescript
// app/api/bounties/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { bountyCreateSchema, paginationSchema, parseSearchParams } from '@/lib/api/schemas'
import { success, paginated, handleApiError } from '@/lib/api/responses'
import { requireTier } from '@/lib/auth/middleware'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const queryParams = parseSearchParams(url)
    const pagination = paginationSchema.parse(queryParams)
    const status = url.searchParams.get('status') || 'open'
    const sortBy = url.searchParams.get('sort') || 'xp_reward'

    const supabase = await createClient()
    const offset = (pagination.page - 1) * pagination.per_page

    const { data: bounties, count, error } = await supabase
      .from('research_bounties')
      .select(
        `
        *,
        user_profiles!research_bounties_created_by_fkey ( display_name, avatar_url )
      `,
        { count: 'exact' }
      )
      .eq('status', status)
      .order(sortBy === 'xp_reward' ? 'xp_reward' : 'created_at', { ascending: false })
      .range(offset, offset + pagination.per_page - 1)

    if (error) {
      throw new Error(`Bounties query failed: ${error.message}`)
    }

    const bountiesWithMeta = (bounties || []).map((b: any) => ({
      ...b,
      creator_display_name: b.user_profiles?.display_name,
    }))

    return paginated(bountiesWithMeta, pagination.page, pagination.per_page, count || 0)
  } catch (err) {
    return handleApiError(err)
  }
}

export async function POST(request: NextRequest) {
  try {
    // Require level 3+ (researcher tier) to create bounties
    const userOrResponse = await requireTier('contributor')
    if (userOrResponse instanceof Response) return userOrResponse
    const user = userOrResponse

    const body = await request.json()
    const input = bountyCreateSchema.parse(body)

    const supabase = await createClient()

    const { data: bounty, error } = await supabase
      .from('research_bounties')
      .insert({
        created_by: user.id,
        title: input.title,
        description: input.description,
        entity_ids: input.entity_ids,
        target_type: input.target_type,
        xp_reward: input.xp_reward,
        status: 'open',
        expires_at: input.expires_at || null,
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create bounty: ${error.message}`)
    }

    return success(bounty)
  } catch (err) {
    return handleApiError(err)
  }
}
```

### Step 29: Create facts route

File: `app/api/facts/route.ts`

```typescript
// app/api/facts/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { factCreateSchema, paginationSchema, parseSearchParams } from '@/lib/api/schemas'
import { success, paginated, handleApiError } from '@/lib/api/responses'
import { requireAuth } from '@/lib/auth/middleware'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const queryParams = parseSearchParams(url)
    const pagination = paginationSchema.parse(queryParams)
    const searchQuery = url.searchParams.get('q')
    const status = url.searchParams.get('status') || 'verified'

    const supabase = await createClient()
    const offset = (pagination.page - 1) * pagination.per_page

    let query = supabase
      .from('fact_registry')
      .select('*', { count: 'exact' })
      .eq('status', status)
      .order('verification_count', { ascending: false })
      .range(offset, offset + pagination.per_page - 1)

    if (searchQuery) {
      query = query.ilike('fact_text', `%${searchQuery}%`)
    }

    const { data: facts, count, error } = await query

    if (error) {
      throw new Error(`Facts query failed: ${error.message}`)
    }

    return paginated(facts || [], pagination.page, pagination.per_page, count || 0)
  } catch (err) {
    return handleApiError(err)
  }
}

export async function POST(request: NextRequest) {
  try {
    const userOrResponse = await requireAuth()
    if (userOrResponse instanceof Response) return userOrResponse
    const user = userOrResponse

    const body = await request.json()
    const input = factCreateSchema.parse(body)

    const supabase = await createClient()

    const { data: fact, error } = await supabase
      .from('fact_registry')
      .insert({
        fact_text: input.fact_text,
        entity_ids: input.entity_ids,
        supporting_chunk_ids: input.supporting_chunk_ids,
        supporting_document_ids: input.supporting_document_ids,
        created_by: user.id,
        status: 'proposed',
        confidence: 0,
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to propose fact: ${error.message}`)
    }

    return success(fact)
  } catch (err) {
    return handleApiError(err)
  }
}
```

### Step 30: Create content-type browse routes

File: `app/api/photos/route.ts`

```typescript
// app/api/photos/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { paginationSchema, parseSearchParams } from '@/lib/api/schemas'
import { paginated, handleApiError } from '@/lib/api/responses'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const queryParams = parseSearchParams(url)
    const pagination = paginationSchema.parse(queryParams)
    const datasetId = url.searchParams.get('dataset_id')
    const hasRedaction = url.searchParams.get('has_redaction')

    const supabase = await createClient()
    const offset = (pagination.page - 1) * pagination.per_page

    let query = supabase
      .from('images')
      .select(
        `
        id,
        document_id,
        filename,
        storage_path,
        description,
        width,
        height,
        is_redacted,
        created_at,
        datasets ( name )
      `,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + pagination.per_page - 1)

    if (datasetId) {
      query = query.eq('dataset_id', datasetId)
    }
    if (hasRedaction === 'true') {
      query = query.eq('is_redacted', true)
    }

    const { data: images, count, error } = await query

    if (error) {
      throw new Error(`Photos query failed: ${error.message}`)
    }

    return paginated(images || [], pagination.page, pagination.per_page, count || 0)
  } catch (err) {
    return handleApiError(err)
  }
}
```

File: `app/api/audio/route.ts`

```typescript
// app/api/audio/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { paginationSchema, parseSearchParams } from '@/lib/api/schemas'
import { paginated, handleApiError } from '@/lib/api/responses'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const queryParams = parseSearchParams(url)
    const pagination = paginationSchema.parse(queryParams)
    const datasetId = url.searchParams.get('dataset_id')

    const supabase = await createClient()
    const offset = (pagination.page - 1) * pagination.per_page

    let query = supabase
      .from('audio_files')
      .select(
        `
        id,
        document_id,
        filename,
        storage_path,
        duration_seconds,
        transcript,
        file_type,
        processing_status,
        created_at,
        datasets ( name )
      `,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + pagination.per_page - 1)

    if (datasetId) {
      query = query.eq('dataset_id', datasetId)
    }

    const { data: audioFiles, count, error } = await query

    if (error) {
      throw new Error(`Audio query failed: ${error.message}`)
    }

    return paginated(audioFiles || [], pagination.page, pagination.per_page, count || 0)
  } catch (err) {
    return handleApiError(err)
  }
}
```

File: `app/api/flights/route.ts`

```typescript
// app/api/flights/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { paginationSchema, parseSearchParams } from '@/lib/api/schemas'
import { paginated, handleApiError } from '@/lib/api/responses'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const queryParams = parseSearchParams(url)
    const pagination = paginationSchema.parse(queryParams)
    const passenger = url.searchParams.get('passenger')
    const dateFrom = url.searchParams.get('date_from')
    const dateTo = url.searchParams.get('date_to')
    const aircraft = url.searchParams.get('aircraft')

    const supabase = await createClient()
    const offset = (pagination.page - 1) * pagination.per_page

    // Flight data is stored as structured_data_extractions with type 'flight_manifest'
    let query = supabase
      .from('structured_data_extractions')
      .select(
        `
        id,
        document_id,
        chunk_id,
        extracted_data,
        confidence,
        created_at,
        documents ( filename )
      `,
        { count: 'exact' }
      )
      .eq('extraction_type', 'flight_manifest')
      .order('created_at', { ascending: false })
      .range(offset, offset + pagination.per_page - 1)

    const { data: extractions, count, error } = await query

    if (error) {
      throw new Error(`Flights query failed: ${error.message}`)
    }

    // Transform extractions into flight records and apply filters
    let flights = (extractions || []).map((ext: any) => ({
      id: ext.id,
      date: ext.extracted_data?.date || null,
      aircraft: ext.extracted_data?.aircraft || null,
      origin: ext.extracted_data?.origin || null,
      destination: ext.extracted_data?.destination || null,
      passengers: ext.extracted_data?.passengers || [],
      document_id: ext.document_id,
      document_filename: ext.documents?.filename || null,
      page_number: ext.extracted_data?.page_number || null,
      confidence: ext.confidence,
    }))

    // Apply client-side filters (since JSONB filtering is complex)
    if (passenger) {
      const lowerPassenger = passenger.toLowerCase()
      flights = flights.filter((f: any) =>
        f.passengers.some((p: string) => p.toLowerCase().includes(lowerPassenger))
      )
    }
    if (aircraft) {
      const lowerAircraft = aircraft.toLowerCase()
      flights = flights.filter(
        (f: any) => f.aircraft && f.aircraft.toLowerCase().includes(lowerAircraft)
      )
    }

    return paginated(flights, pagination.page, pagination.per_page, count || 0)
  } catch (err) {
    return handleApiError(err)
  }
}
```

### Step 31: Create chat API route (SSE streaming)

File: `app/api/chat/route.ts`

```typescript
// app/api/chat/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { chatRequestSchema } from '@/lib/api/schemas'
import { handleApiError } from '@/lib/api/responses'
import { getUser } from '@/lib/auth/middleware'
import { checkRateLimit, getClientIP, RATE_LIMITS } from '@/lib/auth/rate-limit'

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

    // For now, return a placeholder SSE stream.
    // Phase 5 (AI providers) will integrate real LLM responses.
    // This sets up the SSE infrastructure correctly.

    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        // Send initial event
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'text_delta', content: 'I am the Epstein Archive AI assistant. ' })}\n\n`
          )
        )

        // Simulate a response about the query
        const responseChunks = [
          'AI chat integration is not yet active. ',
          'Once Phase 5 (AI Providers) is complete, ',
          'I will be able to search across the corpus ',
          'and provide answers with full citations. ',
          'For now, you can use the search page to find documents.',
        ]

        for (const chunk of responseChunks) {
          await new Promise((resolve) => setTimeout(resolve, 50))
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'text_delta', content: chunk })}\n\n`
            )
          )
        }

        // Send done event
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'done', conversation_id: conversationId })}\n\n`
          )
        )

        controller.close()
      },
    })

    // Update conversation with the user message
    const { data: existingConversation } = await supabase
      .from('chat_conversations')
      .select('messages, message_count')
      .eq('id', conversationId)
      .single()

    const existingMessages = (existingConversation?.messages as any[]) || []
    existingMessages.push({
      id: crypto.randomUUID(),
      role: 'user',
      content: input.message,
      created_at: new Date().toISOString(),
    })

    await supabase
      .from('chat_conversations')
      .update({
        messages: existingMessages,
        message_count: (existingConversation?.message_count || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId)

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
```

### Step 32: Create utility libraries

File: `lib/utils/citations.ts`

```typescript
// lib/utils/citations.ts

export interface CitationSource {
  document_id: string
  document_filename: string
  page_number: number | null
  chunk_id?: string
  dataset_name?: string | null
}

/**
 * Format a citation string: "[Document Name, Page X]"
 */
export function formatCitation(source: CitationSource): string {
  const pagePart = source.page_number ? `, Page ${source.page_number}` : ''
  return `[${source.document_filename}${pagePart}]`
}

/**
 * Format a citation with dataset context: "[Document Name, Page X] (Dataset 3)"
 */
export function formatCitationWithDataset(source: CitationSource): string {
  const base = formatCitation(source)
  if (source.dataset_name) {
    return `${base} (${source.dataset_name})`
  }
  return base
}

/**
 * Generate a clickable citation link path.
 */
export function citationLink(source: CitationSource): string {
  const base = `/document/${source.document_id}`
  if (source.page_number) {
    return `${base}#page-${source.page_number}`
  }
  return base
}

/**
 * Parse citation references from AI-generated text.
 * Looks for patterns like [Document Name, Page X] and extracts them.
 */
export function parseCitations(text: string): Array<{ raw: string; filename: string; page: number | null }> {
  const citationRegex = /\[([^\]]+?)(?:,\s*Page\s*(\d+))?\]/g
  const citations: Array<{ raw: string; filename: string; page: number | null }> = []

  let match
  while ((match = citationRegex.exec(text)) !== null) {
    citations.push({
      raw: match[0],
      filename: match[1].trim(),
      page: match[2] ? parseInt(match[2], 10) : null,
    })
  }

  return citations
}

/**
 * Format multiple citations as a footnote list.
 */
export function formatFootnotes(sources: CitationSource[]): string {
  return sources
    .map((source, i) => `[${i + 1}] ${source.document_filename}${source.page_number ? `, p. ${source.page_number}` : ''}`)
    .join('\n')
}
```

File: `lib/utils/dates.ts`

```typescript
// lib/utils/dates.ts

export type DatePrecision = 'exact' | 'day' | 'month' | 'year' | 'approximate'

/**
 * Parse various date formats commonly found in OCR text.
 * Returns a Date object or null if parsing fails.
 */
export function parseOCRDate(text: string): Date | null {
  const cleaned = text.trim()

  // ISO format: 2003-04-15
  const isoMatch = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) {
    return new Date(cleaned)
  }

  // US format: 04/15/2003, 4/15/03
  const usMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (usMatch) {
    const month = parseInt(usMatch[1], 10)
    const day = parseInt(usMatch[2], 10)
    let year = parseInt(usMatch[3], 10)
    if (year < 100) year += year > 50 ? 1900 : 2000
    return new Date(year, month - 1, day)
  }

  // Written format: April 15, 2003 / Apr 15, 2003
  const writtenMatch = cleaned.match(
    /^(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})$/i
  )
  if (writtenMatch) {
    return new Date(cleaned)
  }

  // Year only: 2003
  const yearMatch = cleaned.match(/^(\d{4})$/)
  if (yearMatch) {
    return new Date(parseInt(yearMatch[1], 10), 0, 1)
  }

  return null
}

/**
 * Determine the precision of a parsed date string.
 */
export function getDatePrecision(text: string): DatePrecision {
  const cleaned = text.trim()

  if (/^\d{4}$/.test(cleaned)) return 'year'
  if (/^(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}$/i.test(cleaned)) return 'month'
  if (/circa|approx|around|about|~|\?/i.test(cleaned)) return 'approximate'
  if (/^\d{4}-\d{2}-\d{2}/.test(cleaned)) return 'exact'

  return 'day'
}

/**
 * Display a date with appropriate precision.
 */
export function displayDate(date: string | Date | null, precision?: DatePrecision): string {
  if (!date) return 'Unknown date'

  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return 'Invalid date'

  switch (precision) {
    case 'year':
      return d.getFullYear().toString()
    case 'month':
      return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    case 'approximate':
      return `c. ${d.getFullYear()}`
    case 'day':
    case 'exact':
    default:
      return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  }
}

/**
 * Format a date range for display.
 */
export function formatDateRange(from: string | null, to: string | null): string {
  if (!from && !to) return 'Unknown period'
  if (from && !to) return `${displayDate(from)} -- present`
  if (!from && to) return `Until ${displayDate(to)}`
  return `${displayDate(from)} -- ${displayDate(to)}`
}
```

File: `lib/utils/storage.ts`

```typescript
// lib/utils/storage.ts
import { createClient } from '@/lib/supabase/server'

const DEFAULT_EXPIRY_SECONDS = 3600 // 1 hour

/**
 * Generate a signed URL for accessing a file in Supabase Storage.
 * Files are stored in the 'documents' bucket by default.
 */
export async function getSignedUrl(
  storagePath: string,
  bucket: string = 'documents',
  expiresIn: number = DEFAULT_EXPIRY_SECONDS
): Promise<string | null> {
  const supabase = await createClient()

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(storagePath, expiresIn)

  if (error) {
    console.error('[Storage] Failed to create signed URL:', error.message)
    return null
  }

  return data.signedUrl
}

/**
 * Generate signed URLs for multiple files in batch.
 */
export async function getSignedUrls(
  storagePaths: string[],
  bucket: string = 'documents',
  expiresIn: number = DEFAULT_EXPIRY_SECONDS
): Promise<Map<string, string>> {
  const supabase = await createClient()
  const urlMap = new Map<string, string>()

  // Supabase supports batch signed URL generation
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(storagePaths, expiresIn)

  if (error) {
    console.error('[Storage] Failed to create batch signed URLs:', error.message)
    return urlMap
  }

  for (const item of data || []) {
    if (item.signedUrl && item.path) {
      urlMap.set(item.path, item.signedUrl)
    }
  }

  return urlMap
}

/**
 * Get the public URL for a file (if bucket is public).
 */
export async function getPublicUrl(
  storagePath: string,
  bucket: string = 'documents'
): Promise<string> {
  const supabase = await createClient()

  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath)

  return data.publicUrl
}
```

### Step 33: Create chat streaming utilities

File: `lib/chat/streaming.ts`

```typescript
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
```

File: `lib/chat/chat-service.ts`

```typescript
// lib/chat/chat-service.ts
import type { ChatStreamEvent, ChatRequest, ChatMessage, Citation } from '@/types/chat'
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
          options.onDone()
          break
        case 'error':
          options.onError(event.error || 'Unknown streaming error')
          break
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
```

### Step 34: Verify build

```bash
pnpm build
```

Fix any TypeScript errors. The most common will be:
- Import path issues (ensure `@/` alias resolves correctly)
- Missing type definitions (ensure Phase 2 types exist)
- Zod schema type inference issues (ensure `zod` is installed)

---

## Gotchas

1. **Auth middleware creates a new Supabase client per request.** Each call to `createClient()` in `lib/supabase/server.ts` reads cookies from the request. In API route handlers, you must call `createClient()` inside the handler function, not at module scope. Module-scope clients would share cookies across requests.

2. **`requireAuth()` returns `Response | AuthenticatedUser`.** Use the pattern `if (userOrResponse instanceof Response) return userOrResponse` to type-narrow. This is intentional --- it avoids throwing exceptions for auth failures, keeping the control flow explicit.

3. **Rate limiting is per-instance, not global.** The in-memory `Map` resets when the serverless function cold-starts or when a new instance is created. For production, replace with Redis (Upstash) or a database-backed solution. The current implementation is sufficient for development and low-traffic launch.

4. **Supabase RPC calls return arrays.** Even `get_redaction_stats()` returns a single-row array, not an object. Access the first element with `stats?.[0]`. The stats route handles this.

5. **`params` is a Promise in Next.js 14+.** Route handler params must be awaited: `const { id } = await params`. This is a breaking change from Next.js 13. All route handlers in this phase use the correct pattern.

6. **SSE streaming requires `text/event-stream` content type.** The chat route returns a `ReadableStream` with proper SSE headers. The client must parse `data:` lines, not consume the response as JSON. The `lib/chat/streaming.ts` module handles this.

7. **Zod `.default()` only applies when the field is `undefined`, not `null`.** If the client sends `{ page: null }`, Zod will reject it. The `parseSearchParams` utility converts URL params to the correct types, but POST body parsing relies on the client sending correct types.

8. **Supabase filters on joined tables use dot notation.** Filtering `documents.dataset_id` in a query that joins `chunks` with `documents` requires the `!inner` join modifier. Without it, the filter applies as a LEFT JOIN and returns null documents instead of filtering them out.

9. **The chat route is a placeholder.** It returns a simulated SSE stream with a hardcoded message. Real LLM integration happens in Phase 5 (AI Providers). The SSE infrastructure, conversation management, and rate limiting are all functional.

10. **`setInterval` guard for serverless.** The rate limiter uses `typeof setInterval !== 'undefined'` before calling `setInterval` because some serverless environments do not support timers. The cleanup is optional --- entries expire naturally via the `reset_at` timestamp check.

11. **JSONB filtering is complex in Supabase JS.** The flights route filters passengers in JavaScript after fetching results, rather than constructing complex JSONB queries. For production with large datasets, create a dedicated RPC function with `jsonb_path_exists`.

12. **Self-voting prevention.** Both the redaction vote and annotation vote routes prevent users from voting on their own submissions. This is enforced at the API level, not just the UI level.

---

## Files to Create

```
lib/api/
├── responses.ts
└── schemas.ts
lib/auth/
├── middleware.ts
└── rate-limit.ts
lib/utils/
├── citations.ts
├── dates.ts
└── storage.ts
lib/chat/
├── chat-service.ts
└── streaming.ts
app/api/
├── auth/
│   └── callback/
│       └── route.ts
├── search/
│   ├── route.ts
│   └── multimodal/
│       └── route.ts
├── chat/
│   └── route.ts
├── entity/[id]/
│   ├── route.ts
│   ├── connections/
│   │   └── route.ts
│   └── dossier/
│       └── route.ts
├── document/[id]/
│   ├── route.ts
│   └── similar/
│       └── route.ts
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
└── flights/
    └── route.ts
```

## Acceptance Criteria

1. Auth callback (`GET /api/auth/callback`) correctly exchanges code for session and creates `user_profiles` record on first login
2. Auth middleware (`requireAuth()`) returns 401 for unauthenticated requests and a valid user object for authenticated ones
3. Rate limiter returns 429 with proper `Retry-After` headers when limits are exceeded
4. All API routes validate input with Zod and return 400 with descriptive messages for invalid input
5. Search API (`POST /api/search`) returns paginated results with correct `SearchResult` shape
6. Multimodal search (`POST /api/search/multimodal`) searches across documents, images, and videos
7. Entity API (`GET /api/entity/[id]`) returns entity details with mention stats and related entities
8. Entity connections (`GET /api/entity/[id]/connections`) returns nodes + edges graph data
9. Document API (`GET /api/document/[id]`) returns document metadata, paginated chunks, redactions, and mentions
10. Similar documents (`GET /api/document/[id]/similar`) returns empty array before embeddings exist
11. Protected routes (`/api/redaction/[id]/propose`, `/api/redaction/[id]/vote`, `/api/annotations POST`) return 401 without auth
12. Redaction proposal creates a new `redaction_proposals` record and triggers confidence calculation
13. Voting updates proposal vote counts and triggers confidence recalculation
14. Chat API (`POST /api/chat`) streams SSE events with proper `text/event-stream` content type
15. Stats API returns corpus_stats data (from materialized view or live fallback)
16. Random document returns a valid document ID
17. Discoveries feed returns confirmed redaction solves sorted by date
18. Today-in-history returns documents matching today's month and day
19. Entity dossier compiles involvement summary, relationships, and timeline
20. Annotations support create (POST), list with replies (GET), and voting
21. Investigation threads support CRUD operations with ownership checks
22. OCR corrections, bounties, facts, and notifications routes all function correctly
23. Content-type browse routes (photos, audio, flights) return paginated data
24. Citation utilities correctly format `[Document Name, Page X]` strings
25. Date utilities parse US, ISO, and written date formats
26. Storage utilities generate signed URLs from Supabase Storage
27. Chat streaming utilities parse SSE events and handle reconnection
28. All routes handle errors gracefully (400 for bad input, 401 for auth, 404 for not found, 429 for rate limit, 500 for server errors)
29. `pnpm build` succeeds with zero errors

## Design Notes

- All API responses use the `{ data, error, meta }` envelope. Never return raw data or raw error strings.
- Paginated responses always include `{ page, per_page, total, has_more }` in the `meta` field.
- Auth is optional for read-only routes (search, entity, document, stats) and required for write routes (proposals, votes, annotations, threads).
- Rate limits are tiered: free chat gets 20/day, paid chat gets 200/day, search gets 60/min.
- The chat route uses Web Streams API (`ReadableStream`) for SSE --- this is the standard pattern for Next.js App Router streaming.
- Entity dossier is structured as JSON sections (not a formatted string) so the frontend can render it with proper styling.
- Flights are stored as `structured_data_extractions` with `extraction_type = 'flight_manifest'`, not a dedicated table.
- The `parseSearchParams` utility handles type coercion from URL strings to numbers/booleans for Zod validation of GET request query parameters.

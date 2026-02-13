import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSupabaseClient } from '../../helpers/supabase-mock'
import { createGetRequest, createPostRequest, parseResponseBody } from '../../helpers/request-mock'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/auth/middleware', () => ({
  requireAuth: vi.fn(),
}))
vi.mock('@/lib/auth/rate-limit', () => ({
  checkRateLimit: vi.fn().mockReturnValue(null),
  RATE_LIMITS: { annotation: { prefix: 'annotation', max_requests: 30, window_seconds: 3600 } },
}))

import { GET, POST } from '@/app/api/annotations/route'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/middleware'

const mockCreateClient = vi.mocked(createClient)
const mockRequireAuth = vi.mocked(requireAuth)
const UUID = '550e8400-e29b-41d4-a716-446655440000'

describe('GET /api/annotations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const mock = createMockSupabaseClient({ data: [], error: null, count: 0 })
    mockCreateClient.mockResolvedValue(mock as never)
  })

  it('returns 200 with paginated list', async () => {
    const req = createGetRequest('/api/annotations')
    const res = await GET(req as never)
    expect(res.status).toBe(200)
  })

  it('filters by document_id', async () => {
    const req = createGetRequest('/api/annotations', { document_id: UUID })
    const res = await GET(req as never)
    expect(res.status).toBe(200)
  })

  it('filters by chunk_id', async () => {
    const req = createGetRequest('/api/annotations', { chunk_id: UUID })
    const res = await GET(req as never)
    expect(res.status).toBe(200)
  })

  it('returns paginated response shape', async () => {
    const req = createGetRequest('/api/annotations')
    const res = await GET(req as never)
    const body = await parseResponseBody(res)
    expect(body).toHaveProperty('meta')
    expect(body.meta).toHaveProperty('page')
  })

  it('handles Supabase error', async () => {
    const mock = createMockSupabaseClient({ data: null, error: { message: 'fail' }, count: 0 })
    mockCreateClient.mockResolvedValue(mock as never)
    const req = createGetRequest('/api/annotations')
    const res = await GET(req as never)
    expect(res.status).toBe(500)
  })
})

describe('POST /api/annotations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const mock = createMockSupabaseClient({ data: { id: 'ann-1' }, error: null })
    mockCreateClient.mockResolvedValue(mock as never)
    mockRequireAuth.mockResolvedValue({ id: 'user-1', email: 'test@test.com', user_metadata: {} })
  })

  it('returns 200 with valid input', async () => {
    const req = createPostRequest('/api/annotations', {
      document_id: UUID,
      content: 'This is interesting',
    })
    const res = await POST(req as never)
    expect(res.status).toBe(200)
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockResolvedValue(new Response(null, { status: 401 }))
    const req = createPostRequest('/api/annotations', {
      document_id: UUID,
      content: 'test',
    })
    const res = await POST(req as never)
    expect(res.status).toBe(401)
  })

  it('returns 400 for empty content', async () => {
    const req = createPostRequest('/api/annotations', {
      document_id: UUID,
      content: '',
    })
    const res = await POST(req as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 for missing document_id', async () => {
    const req = createPostRequest('/api/annotations', { content: 'test' })
    const res = await POST(req as never)
    expect(res.status).toBe(400)
  })

  it('handles Supabase insert error', async () => {
    const mock = createMockSupabaseClient({ data: null, error: { message: 'insert failed' } })
    mockCreateClient.mockResolvedValue(mock as never)
    const req = createPostRequest('/api/annotations', {
      document_id: UUID,
      content: 'test annotation',
    })
    const res = await POST(req as never)
    expect(res.status).toBe(500)
  })
})

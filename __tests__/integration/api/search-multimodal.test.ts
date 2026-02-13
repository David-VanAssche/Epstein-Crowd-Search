import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSupabaseClient } from '../../helpers/supabase-mock'
import { createPostRequest, parseResponseBody } from '../../helpers/request-mock'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/auth/middleware', () => ({
  getUser: vi.fn().mockResolvedValue(null),
}))
vi.mock('@/lib/auth/rate-limit', () => ({
  checkRateLimit: vi.fn().mockReturnValue(null),
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
  RATE_LIMITS: { search: { prefix: 'search', max_requests: 60, window_seconds: 60 } },
}))

import { POST } from '@/app/api/search/multimodal/route'
import { createClient } from '@/lib/supabase/server'

const mockCreateClient = vi.mocked(createClient)

describe('POST /api/search/multimodal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const mock = createMockSupabaseClient({ data: [], error: null, count: 0 })
    mockCreateClient.mockResolvedValue(mock as never)
  })

  it('returns 200 with valid query', async () => {
    const req = createPostRequest('/api/search/multimodal', { query: 'epstein island' })
    const res = await POST(req as never)
    expect(res.status).toBe(200)
  })

  it('returns 400 for empty query', async () => {
    const req = createPostRequest('/api/search/multimodal', { query: '' })
    const res = await POST(req as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 for missing query', async () => {
    const req = createPostRequest('/api/search/multimodal', {})
    const res = await POST(req as never)
    expect(res.status).toBe(400)
  })

  it('accepts modality overrides', async () => {
    const req = createPostRequest('/api/search/multimodal', {
      query: 'test',
      modalities: { documents: true, images: false, videos: false },
    })
    const res = await POST(req as never)
    expect(res.status).toBe(200)
  })

  it('applies default modalities', async () => {
    const req = createPostRequest('/api/search/multimodal', { query: 'test' })
    const res = await POST(req as never)
    expect(res.status).toBe(200)
  })

  it('returns response with data array', async () => {
    const req = createPostRequest('/api/search/multimodal', { query: 'test' })
    const res = await POST(req as never)
    const body = await parseResponseBody(res)
    expect(body).toHaveProperty('data')
  })

  it('handles Supabase error gracefully (null data returns empty)', async () => {
    const mock = createMockSupabaseClient({ data: null, error: { message: 'fail' }, count: 0 })
    mockCreateClient.mockResolvedValue(mock as never)
    const req = createPostRequest('/api/search/multimodal', { query: 'test' })
    const res = await POST(req as never)
    // Route uses `if (docResults)` pattern - null data is skipped, not thrown
    expect(res.status).toBe(200)
  })

  it('handles thrown exception with 500', async () => {
    const mock = createMockSupabaseClient({ data: [], error: null, count: 0 })
    // Override from() to throw
    mock.from = vi.fn(() => { throw new Error('connection failed') })
    mockCreateClient.mockResolvedValue(mock as never)
    const req = createPostRequest('/api/search/multimodal', { query: 'test' })
    const res = await POST(req as never)
    expect(res.status).toBe(500)
  })

  it('applies rate limiting', async () => {
    const { checkRateLimit } = await import('@/lib/auth/rate-limit')
    vi.mocked(checkRateLimit).mockReturnValueOnce(
      new Response(JSON.stringify({ error: 'Rate limited' }), { status: 429 })
    )
    const req = createPostRequest('/api/search/multimodal', { query: 'test' })
    const res = await POST(req as never)
    expect(res.status).toBe(429)
  })
})

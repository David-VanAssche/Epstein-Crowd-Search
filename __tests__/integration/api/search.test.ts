import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSupabaseClient } from '../../helpers/supabase-mock'
import { createPostRequest, createGetRequest, parseResponseBody } from '../../helpers/request-mock'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/auth/middleware', () => ({
  getUser: vi.fn().mockResolvedValue(null),
}))
vi.mock('@/lib/auth/rate-limit', () => ({
  checkRateLimit: vi.fn().mockReturnValue(null),
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
  RATE_LIMITS: { search: { prefix: 'search', max_requests: 60, window_seconds: 60 } },
}))

import { POST, GET } from '@/app/api/search/route'
import { createClient } from '@/lib/supabase/server'

const mockCreateClient = vi.mocked(createClient)

describe('POST /api/search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const mock = createMockSupabaseClient({ data: [], error: null, count: 0 })
    mockCreateClient.mockResolvedValue(mock as never)
  })

  it('returns 200 with valid query', async () => {
    const req = createPostRequest('/api/search', { query: 'epstein', page: 1, per_page: 20 })
    const res = await POST(req as never)
    expect(res.status).toBe(200)
    const body = await parseResponseBody(res)
    expect(body).toHaveProperty('data')
    expect(body).toHaveProperty('meta')
  })

  it('returns 400 for empty query', async () => {
    const req = createPostRequest('/api/search', { query: '' })
    const res = await POST(req as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 for missing query', async () => {
    const req = createPostRequest('/api/search', {})
    const res = await POST(req as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 for query over 500 chars', async () => {
    const req = createPostRequest('/api/search', { query: 'a'.repeat(501) })
    const res = await POST(req as never)
    expect(res.status).toBe(400)
  })

  it('returns paginated response shape', async () => {
    const req = createPostRequest('/api/search', { query: 'test' })
    const res = await POST(req as never)
    const body = await parseResponseBody(res)
    expect(body.meta).toHaveProperty('page')
    expect(body.meta).toHaveProperty('per_page')
    expect(body.meta).toHaveProperty('total')
    expect(body.meta).toHaveProperty('has_more')
  })

  it('handles Supabase error gracefully', async () => {
    const mock = createMockSupabaseClient({ data: null, error: { message: 'DB error' }, count: 0 })
    mockCreateClient.mockResolvedValue(mock as never)
    const req = createPostRequest('/api/search', { query: 'test' })
    const res = await POST(req as never)
    expect(res.status).toBe(500)
  })

  it('applies dataset filter', async () => {
    const mock = createMockSupabaseClient({ data: [], error: null, count: 0 })
    mockCreateClient.mockResolvedValue(mock as never)
    const req = createPostRequest('/api/search', {
      query: 'test',
      filters: { dataset_id: '550e8400-e29b-41d4-a716-446655440000' },
    })
    const res = await POST(req as never)
    expect(res.status).toBe(200)
  })

  it('respects rate limiting', async () => {
    const { checkRateLimit } = await import('@/lib/auth/rate-limit')
    const mockRL = vi.mocked(checkRateLimit)
    const rlResponse = new Response(JSON.stringify({ error: 'Rate limited' }), { status: 429 })
    mockRL.mockReturnValueOnce(rlResponse)

    const req = createPostRequest('/api/search', { query: 'test' })
    const res = await POST(req as never)
    expect(res.status).toBe(429)
  })
})

describe('GET /api/search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const mock = createMockSupabaseClient({ data: [], error: null, count: 0 })
    mockCreateClient.mockResolvedValue(mock as never)
  })

  it('returns empty array when no q param', async () => {
    const req = createGetRequest('/api/search')
    const res = await GET(req as never)
    expect(res.status).toBe(200)
    const body = await parseResponseBody(res)
    expect(body.data).toEqual([])
  })

  it('returns 200 with q param', async () => {
    const req = createGetRequest('/api/search', { q: 'test' })
    const res = await GET(req as never)
    expect(res.status).toBe(200)
  })

  it('respects page and per_page params', async () => {
    const req = createGetRequest('/api/search', { q: 'test', page: '2', per_page: '10' })
    const res = await GET(req as never)
    expect(res.status).toBe(200)
  })

  it('clamps per_page to max 100', async () => {
    const req = createGetRequest('/api/search', { q: 'test', per_page: '999' })
    const res = await GET(req as never)
    expect(res.status).toBe(200)
  })

  it('handles Supabase error gracefully', async () => {
    const mock = createMockSupabaseClient({ data: null, error: { message: 'DB error' }, count: 0 })
    mockCreateClient.mockResolvedValue(mock as never)
    const req = createGetRequest('/api/search', { q: 'test' })
    const res = await GET(req as never)
    expect(res.status).toBe(500)
  })

  it('applies rate limiting', async () => {
    const { checkRateLimit } = await import('@/lib/auth/rate-limit')
    const mockRL = vi.mocked(checkRateLimit)
    mockRL.mockReturnValueOnce(new Response(JSON.stringify({ error: 'Rate limited' }), { status: 429 }))

    const req = createGetRequest('/api/search', { q: 'test' })
    const res = await GET(req as never)
    expect(res.status).toBe(429)
  })

  it('returns paginated response', async () => {
    const req = createGetRequest('/api/search', { q: 'test' })
    const res = await GET(req as never)
    const body = await parseResponseBody(res)
    expect(body).toHaveProperty('meta')
  })
})

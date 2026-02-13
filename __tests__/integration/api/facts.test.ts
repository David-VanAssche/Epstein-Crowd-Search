import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSupabaseClient } from '../../helpers/supabase-mock'
import { createGetRequest, createPostRequest, parseResponseBody } from '../../helpers/request-mock'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/auth/middleware', () => ({
  requireAuth: vi.fn(),
}))

import { GET, POST } from '@/app/api/facts/route'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/middleware'

const mockCreateClient = vi.mocked(createClient)
const mockRequireAuth = vi.mocked(requireAuth)
const UUID = '550e8400-e29b-41d4-a716-446655440000'

describe('GET /api/facts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const mock = createMockSupabaseClient({ data: [], error: null, count: 0 })
    mockCreateClient.mockResolvedValue(mock as never)
  })

  it('returns 200 with paginated list', async () => {
    const req = createGetRequest('/api/facts')
    const res = await GET(req as never)
    expect(res.status).toBe(200)
  })

  it('returns paginated shape', async () => {
    const req = createGetRequest('/api/facts')
    const res = await GET(req as never)
    const body = await parseResponseBody(res)
    expect(body).toHaveProperty('meta')
  })

  it('handles Supabase error', async () => {
    const mock = createMockSupabaseClient({ data: null, error: { message: 'fail' }, count: 0 })
    mockCreateClient.mockResolvedValue(mock as never)
    const req = createGetRequest('/api/facts')
    const res = await GET(req as never)
    expect(res.status).toBe(500)
  })
})

describe('POST /api/facts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const mock = createMockSupabaseClient({ data: { id: UUID }, error: null })
    mockCreateClient.mockResolvedValue(mock as never)
    mockRequireAuth.mockResolvedValue({ id: 'user-1', email: 'test@test.com', user_metadata: {} })
  })

  it('returns 200 with valid input', async () => {
    const req = createPostRequest('/api/facts', {
      fact_text: 'Epstein visited the island on multiple occasions documented in flight logs.',
    })
    const res = await POST(req as never)
    expect(res.status).toBe(200)
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockResolvedValue(new Response(null, { status: 401 }))
    const req = createPostRequest('/api/facts', {
      fact_text: 'Test fact that is long enough for validation.',
    })
    const res = await POST(req as never)
    expect(res.status).toBe(401)
  })

  it('returns 400 for short fact_text', async () => {
    const req = createPostRequest('/api/facts', { fact_text: 'short' })
    const res = await POST(req as never)
    expect(res.status).toBe(400)
  })

  it('handles Supabase insert error', async () => {
    const mock = createMockSupabaseClient({ data: null, error: { message: 'insert failed' } })
    mockCreateClient.mockResolvedValue(mock as never)
    const req = createPostRequest('/api/facts', {
      fact_text: 'Epstein visited the island on multiple occasions documented in logs.',
    })
    const res = await POST(req as never)
    expect(res.status).toBe(500)
  })

  it('accepts entity_ids and supporting_chunk_ids', async () => {
    const req = createPostRequest('/api/facts', {
      fact_text: 'Test fact that is long enough for the validation requirement.',
      entity_ids: [UUID],
      supporting_chunk_ids: [UUID],
    })
    const res = await POST(req as never)
    expect(res.status).toBe(200)
  })
})

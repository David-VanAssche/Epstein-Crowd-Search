import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSupabaseClient } from '../../helpers/supabase-mock'
import { createGetRequest, createPostRequest, parseResponseBody } from '../../helpers/request-mock'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/auth/middleware', () => ({
  requireAuth: vi.fn(),
}))
vi.mock('@/lib/auth/rate-limit', () => ({
  checkRateLimit: vi.fn().mockReturnValue(null),
  RATE_LIMITS: { proposal: { prefix: 'proposal', max_requests: 10, window_seconds: 3600 } },
}))

import { GET, POST } from '@/app/api/redaction/[id]/propose/route'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/middleware'

const mockCreateClient = vi.mocked(createClient)
const mockRequireAuth = vi.mocked(requireAuth)
const UUID = '550e8400-e29b-41d4-a716-446655440000'

describe('GET /api/redaction/[id]/propose', () => {
  const makeParams = (id: string) => ({ params: Promise.resolve({ id }) })

  beforeEach(() => {
    vi.clearAllMocks()
    const mock = createMockSupabaseClient({ data: [], error: null })
    mockCreateClient.mockResolvedValue(mock as never)
  })

  it('returns 200 with proposals list', async () => {
    const req = createGetRequest(`/api/redaction/${UUID}/propose`)
    const res = await GET(req as never, makeParams(UUID))
    expect(res.status).toBe(200)
  })

  it('returns empty array when no proposals', async () => {
    const req = createGetRequest(`/api/redaction/${UUID}/propose`)
    const res = await GET(req as never, makeParams(UUID))
    const body = await parseResponseBody(res)
    expect(body.data).toEqual([])
  })

  it('handles Supabase error', async () => {
    const mock = createMockSupabaseClient({ data: null, error: { message: 'fail' } })
    mockCreateClient.mockResolvedValue(mock as never)
    const req = createGetRequest(`/api/redaction/${UUID}/propose`)
    const res = await GET(req as never, makeParams(UUID))
    expect(res.status).toBe(500)
  })
})

describe('POST /api/redaction/[id]/propose', () => {
  const makeParams = (id: string) => ({ params: Promise.resolve({ id }) })
  const validBody = {
    proposed_text: 'Jeffrey Epstein',
    evidence_type: 'cross_reference',
    evidence_description: 'This name appears in the related court filing document from 2008.',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    const mock = createMockSupabaseClient({
      data: { id: UUID, status: 'unsolved', char_length_estimate: 15 },
      error: null,
    })
    mock.rpc.mockImplementation(() => Promise.resolve({ data: null, error: null }))
    mockCreateClient.mockResolvedValue(mock as never)
    mockRequireAuth.mockResolvedValue({ id: 'user-1', email: 'test@test.com', user_metadata: {} })
  })

  it('returns 200 with valid input', async () => {
    const req = createPostRequest(`/api/redaction/${UUID}/propose`, validBody)
    const res = await POST(req as never, makeParams(UUID))
    expect(res.status).toBe(200)
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockResolvedValue(new Response(null, { status: 401 }))
    const req = createPostRequest(`/api/redaction/${UUID}/propose`, validBody)
    const res = await POST(req as never, makeParams(UUID))
    expect(res.status).toBe(401)
  })

  it('returns 400 for empty proposed_text', async () => {
    const req = createPostRequest(`/api/redaction/${UUID}/propose`, {
      ...validBody,
      proposed_text: '',
    })
    const res = await POST(req as never, makeParams(UUID))
    expect(res.status).toBe(400)
  })

  it('returns 400 for short evidence_description', async () => {
    const req = createPostRequest(`/api/redaction/${UUID}/propose`, {
      ...validBody,
      evidence_description: 'short',
    })
    const res = await POST(req as never, makeParams(UUID))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid evidence_type', async () => {
    const req = createPostRequest(`/api/redaction/${UUID}/propose`, {
      ...validBody,
      evidence_type: 'invalid_type',
    })
    const res = await POST(req as never, makeParams(UUID))
    expect(res.status).toBe(400)
  })

  it('returns 404 when redaction not found', async () => {
    const mock = createMockSupabaseClient({ data: null, error: { message: 'not found' } })
    mock.rpc.mockImplementation(() => Promise.resolve({ data: null, error: null }))
    mockCreateClient.mockResolvedValue(mock as never)
    const req = createPostRequest(`/api/redaction/${UUID}/propose`, validBody)
    const res = await POST(req as never, makeParams(UUID))
    expect(res.status).toBe(404)
  })

  it('accepts evidence_sources array', async () => {
    const req = createPostRequest(`/api/redaction/${UUID}/propose`, {
      ...validBody,
      evidence_sources: ['https://example.com/doc1'],
    })
    const res = await POST(req as never, makeParams(UUID))
    expect(res.status).toBe(200)
  })

  it('respects rate limiting', async () => {
    const { checkRateLimit } = await import('@/lib/auth/rate-limit')
    vi.mocked(checkRateLimit).mockReturnValueOnce(
      new Response(JSON.stringify({ error: 'Rate limited' }), { status: 429 })
    )
    const req = createPostRequest(`/api/redaction/${UUID}/propose`, validBody)
    const res = await POST(req as never, makeParams(UUID))
    expect(res.status).toBe(429)
  })

  it('accepts optional proposed_entity_id', async () => {
    const req = createPostRequest(`/api/redaction/${UUID}/propose`, {
      ...validBody,
      proposed_entity_id: UUID,
    })
    const res = await POST(req as never, makeParams(UUID))
    expect(res.status).toBe(200)
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSupabaseClient } from '../../helpers/supabase-mock'
import { createGetRequest, createPostRequest, parseResponseBody } from '../../helpers/request-mock'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/auth/middleware', () => ({
  requireTier: vi.fn(),
}))

import { GET, POST } from '@/app/api/bounties/route'
import { createClient } from '@/lib/supabase/server'
import { requireTier } from '@/lib/auth/middleware'

const mockCreateClient = vi.mocked(createClient)
const mockRequireTier = vi.mocked(requireTier)
const UUID = '550e8400-e29b-41d4-a716-446655440000'

describe('GET /api/bounties', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const mock = createMockSupabaseClient({ data: [], error: null, count: 0 })
    mockCreateClient.mockResolvedValue(mock as never)
  })

  it('returns 200 with paginated list', async () => {
    const req = createGetRequest('/api/bounties')
    const res = await GET(req as never)
    expect(res.status).toBe(200)
  })

  it('accepts status filter', async () => {
    const req = createGetRequest('/api/bounties', { status: 'claimed' })
    const res = await GET(req as never)
    expect(res.status).toBe(200)
  })

  it('accepts sort filter', async () => {
    const req = createGetRequest('/api/bounties', { sort: 'created_at' })
    const res = await GET(req as never)
    expect(res.status).toBe(200)
  })

  it('handles Supabase error', async () => {
    const mock = createMockSupabaseClient({ data: null, error: { message: 'fail' }, count: 0 })
    mockCreateClient.mockResolvedValue(mock as never)
    const req = createGetRequest('/api/bounties')
    const res = await GET(req as never)
    expect(res.status).toBe(500)
  })
})

describe('POST /api/bounties', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const mock = createMockSupabaseClient({ data: { id: UUID }, error: null })
    mockCreateClient.mockResolvedValue(mock as never)
    mockRequireTier.mockResolvedValue({ id: 'user-1', email: 'test@test.com', user_metadata: {} })
  })

  it('returns 200 with valid input', async () => {
    const req = createPostRequest('/api/bounties', {
      title: 'Find flight connections',
      description: 'Look for connections between flight logs and financial records.',
      target_type: 'pattern',
    })
    const res = await POST(req as never)
    expect(res.status).toBe(200)
  })

  it('returns 401/403 when below researcher tier', async () => {
    mockRequireTier.mockResolvedValue(new Response(null, { status: 403 }))
    const req = createPostRequest('/api/bounties', {
      title: 'Test',
      description: 'This bounty requires researcher tier to create.',
      target_type: 'entity',
    })
    const res = await POST(req as never)
    expect(res.status).toBe(403)
  })

  it('returns 400 for missing title', async () => {
    const req = createPostRequest('/api/bounties', {
      description: 'This bounty has no title but has enough description text.',
      target_type: 'entity',
    })
    const res = await POST(req as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 for short description', async () => {
    const req = createPostRequest('/api/bounties', {
      title: 'Test',
      description: 'short',
      target_type: 'entity',
    })
    const res = await POST(req as never)
    expect(res.status).toBe(400)
  })
})

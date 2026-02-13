import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSupabaseClient } from '../../helpers/supabase-mock'
import { createGetRequest, parseResponseBody } from '../../helpers/request-mock'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { GET } from '@/app/api/timeline/route'
import { createClient } from '@/lib/supabase/server'

const mockCreateClient = vi.mocked(createClient)
const UUID = '550e8400-e29b-41d4-a716-446655440000'

describe('GET /api/timeline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const mock = createMockSupabaseClient({ data: [], error: null, count: 0 })
    mockCreateClient.mockResolvedValue(mock as never)
  })

  it('returns 200 with paginated list', async () => {
    const req = createGetRequest('/api/timeline')
    const res = await GET(req as never)
    expect(res.status).toBe(200)
  })

  it('returns paginated response shape', async () => {
    const req = createGetRequest('/api/timeline')
    const res = await GET(req as never)
    const body = await parseResponseBody(res)
    expect(body).toHaveProperty('meta')
    expect(body.meta).toHaveProperty('total')
  })

  it('accepts entity_id filter', async () => {
    const req = createGetRequest('/api/timeline', { entity_id: UUID })
    const res = await GET(req as never)
    expect(res.status).toBe(200)
  })

  it('accepts date range filters', async () => {
    const req = createGetRequest('/api/timeline', {
      date_from: '2003-01-01T00:00:00Z',
      date_to: '2005-12-31T23:59:59Z',
    })
    const res = await GET(req as never)
    expect(res.status).toBe(200)
  })

  it('handles Supabase error', async () => {
    const mock = createMockSupabaseClient({ data: null, error: { message: 'fail' }, count: 0 })
    mockCreateClient.mockResolvedValue(mock as never)
    const req = createGetRequest('/api/timeline')
    const res = await GET(req as never)
    expect(res.status).toBe(500)
  })

  it('accepts pagination params', async () => {
    const req = createGetRequest('/api/timeline', { page: '2', per_page: '10' })
    const res = await GET(req as never)
    expect(res.status).toBe(200)
  })
})

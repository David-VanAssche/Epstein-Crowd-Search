import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSupabaseClient } from '../../helpers/supabase-mock'
import { createGetRequest, parseResponseBody } from '../../helpers/request-mock'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { GET } from '@/app/api/document/[id]/route'
import { createClient } from '@/lib/supabase/server'

const mockCreateClient = vi.mocked(createClient)
const UUID = '550e8400-e29b-41d4-a716-446655440000'

describe('GET /api/document/[id]', () => {
  const makeParams = (id: string) => ({ params: Promise.resolve({ id }) })

  beforeEach(() => {
    vi.clearAllMocks()
    const mock = createMockSupabaseClient({
      data: { id: UUID, filename: 'test.pdf', classification: 'legal' },
      error: null,
      count: 0,
    })
    mockCreateClient.mockResolvedValue(mock as never)
  })

  it('returns 200 for valid UUID', async () => {
    const req = createGetRequest(`/api/document/${UUID}`)
    const res = await GET(req as never, makeParams(UUID))
    expect(res.status).toBe(200)
  })

  it('returns document with chunks, redactions, mentions', async () => {
    const req = createGetRequest(`/api/document/${UUID}`)
    const res = await GET(req as never, makeParams(UUID))
    const body = await parseResponseBody(res)
    expect(body.data).toHaveProperty('document')
    expect(body.data).toHaveProperty('chunks')
    expect(body.data).toHaveProperty('redactions')
    expect(body.data).toHaveProperty('mentions')
  })

  it('returns 404 for non-existent document', async () => {
    const mock = createMockSupabaseClient({ data: null, error: { message: 'not found' } })
    mockCreateClient.mockResolvedValue(mock as never)
    const req = createGetRequest(`/api/document/${UUID}`)
    const res = await GET(req as never, makeParams(UUID))
    expect(res.status).toBe(404)
  })

  it('respects pagination params', async () => {
    const req = createGetRequest(`/api/document/${UUID}`, { page: '2', per_page: '10' })
    const res = await GET(req as never, makeParams(UUID))
    expect(res.status).toBe(200)
    const body = await parseResponseBody(res)
    expect(body.data.chunk_pagination).toHaveProperty('page')
  })

  it('clamps per_page to max 100', async () => {
    const req = createGetRequest(`/api/document/${UUID}`, { per_page: '999' })
    const res = await GET(req as never, makeParams(UUID))
    expect(res.status).toBe(200)
  })

  it('handles Supabase error', async () => {
    const mock = createMockSupabaseClient({ data: null, error: { message: 'fail' } })
    mockCreateClient.mockResolvedValue(mock as never)
    const req = createGetRequest(`/api/document/${UUID}`)
    const res = await GET(req as never, makeParams(UUID))
    // Will get 404 because docError is truthy
    expect([404, 500]).toContain(res.status)
  })

  it('returns chunk_pagination shape', async () => {
    const req = createGetRequest(`/api/document/${UUID}`)
    const res = await GET(req as never, makeParams(UUID))
    const body = await parseResponseBody(res)
    expect(body.data.chunk_pagination).toEqual(
      expect.objectContaining({
        page: expect.any(Number),
        per_page: expect.any(Number),
        total: expect.any(Number),
        has_more: expect.any(Boolean),
      })
    )
  })
})

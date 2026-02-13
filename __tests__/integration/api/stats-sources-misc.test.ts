import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSupabaseClient } from '../../helpers/supabase-mock'
import { createGetRequest, parseResponseBody } from '../../helpers/request-mock'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/auth/middleware', () => ({
  requireAuth: vi.fn(),
}))

import { GET as getStats } from '@/app/api/stats/route'
import { GET as getSources } from '@/app/api/sources/route'
import { GET as getNotifications } from '@/app/api/notifications/route'
import { GET as getOCRCorrections } from '@/app/api/ocr-corrections/route'
import { GET as authCallback } from '@/app/api/auth/callback/route'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/middleware'

const mockCreateClient = vi.mocked(createClient)
const mockRequireAuth = vi.mocked(requireAuth)

describe('GET /api/stats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with stats from materialized view', async () => {
    const mock = createMockSupabaseClient({
      data: { total_documents: 100, total_entities: 50 },
      error: null,
    })
    mockCreateClient.mockResolvedValue(mock as never)
    const req = createGetRequest('/api/stats')
    const res = await getStats(req as never)
    expect(res.status).toBe(200)
  })

  it('returns response envelope', async () => {
    const mock = createMockSupabaseClient({
      data: { total_documents: 100 },
      error: null,
    })
    mockCreateClient.mockResolvedValue(mock as never)
    const req = createGetRequest('/api/stats')
    const res = await getStats(req as never)
    const body = await parseResponseBody(res)
    expect(body).toHaveProperty('data')
    expect(body.error).toBeNull()
  })

  it('falls back to live counts when materialized view fails', async () => {
    const mock = createMockSupabaseClient({ data: null, error: { message: 'no view' }, count: 42 })
    mockCreateClient.mockResolvedValue(mock as never)
    const req = createGetRequest('/api/stats')
    const res = await getStats(req as never)
    expect(res.status).toBe(200)
    const body = await parseResponseBody(res)
    expect(body.data).toHaveProperty('total_documents')
  })

  it('handles complete DB failure', async () => {
    const mock = createMockSupabaseClient({ data: null, error: { message: 'fail' } })
    // Make Promise.all reject
    mockCreateClient.mockResolvedValue(mock as never)
    const req = createGetRequest('/api/stats')
    const res = await getStats(req as never)
    // Should still return something (either 200 with fallback or 500)
    expect([200, 500]).toContain(res.status)
  })
})

describe('GET /api/sources', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with sources list', async () => {
    const mock = createMockSupabaseClient({
      data: [{ id: '1', name: 'Source 1', status: 'active' }],
      error: null,
    })
    mockCreateClient.mockResolvedValue(mock as never)
    const res = await getSources()
    expect(res.status).toBe(200)
  })

  it('returns empty array when no sources', async () => {
    const mock = createMockSupabaseClient({ data: [], error: null })
    mockCreateClient.mockResolvedValue(mock as never)
    const res = await getSources()
    const body = await parseResponseBody(res)
    expect(body.data).toEqual([])
  })

  it('handles Supabase error', async () => {
    const mock = createMockSupabaseClient({ data: null, error: { message: 'fail' } })
    mockCreateClient.mockResolvedValue(mock as never)
    const res = await getSources()
    expect(res.status).toBe(500)
  })

  it('returns data envelope', async () => {
    const mock = createMockSupabaseClient({ data: [], error: null })
    mockCreateClient.mockResolvedValue(mock as never)
    const res = await getSources()
    const body = await parseResponseBody(res)
    expect(body).toHaveProperty('data')
    expect(body).toHaveProperty('error')
  })
})

describe('GET /api/notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const mock = createMockSupabaseClient({ data: [], error: null, count: 0 })
    mockCreateClient.mockResolvedValue(mock as never)
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockResolvedValue(new Response(null, { status: 401 }))
    const req = createGetRequest('/api/notifications')
    const res = await getNotifications(req as never)
    expect(res.status).toBe(401)
  })

  it('returns 200 when authenticated', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'user-1', email: 'test@test.com', user_metadata: {} })
    const req = createGetRequest('/api/notifications')
    const res = await getNotifications(req as never)
    expect(res.status).toBe(200)
  })

  it('returns paginated shape', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'user-1', email: 'test@test.com', user_metadata: {} })
    const req = createGetRequest('/api/notifications')
    const res = await getNotifications(req as never)
    const body = await parseResponseBody(res)
    expect(body).toHaveProperty('meta')
  })

  it('handles Supabase error', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'user-1', email: 'test@test.com', user_metadata: {} })
    const mock = createMockSupabaseClient({ data: null, error: { message: 'fail' }, count: 0 })
    mockCreateClient.mockResolvedValue(mock as never)
    const req = createGetRequest('/api/notifications')
    const res = await getNotifications(req as never)
    expect(res.status).toBe(500)
  })
})

describe('GET /api/ocr-corrections', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const mock = createMockSupabaseClient({ data: [], error: null, count: 0 })
    mockCreateClient.mockResolvedValue(mock as never)
  })

  it('returns 200 with paginated list', async () => {
    const req = createGetRequest('/api/ocr-corrections')
    const res = await getOCRCorrections(req as never)
    expect(res.status).toBe(200)
  })

  it('accepts document_id filter', async () => {
    const req = createGetRequest('/api/ocr-corrections', {
      document_id: '550e8400-e29b-41d4-a716-446655440000',
    })
    const res = await getOCRCorrections(req as never)
    expect(res.status).toBe(200)
  })

  it('returns paginated shape', async () => {
    const req = createGetRequest('/api/ocr-corrections')
    const res = await getOCRCorrections(req as never)
    const body = await parseResponseBody(res)
    expect(body).toHaveProperty('meta')
  })

  it('handles Supabase error', async () => {
    const mock = createMockSupabaseClient({ data: null, error: { message: 'fail' }, count: 0 })
    mockCreateClient.mockResolvedValue(mock as never)
    const req = createGetRequest('/api/ocr-corrections')
    const res = await getOCRCorrections(req as never)
    expect(res.status).toBe(500)
  })
})

describe('GET /api/auth/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('redirects to /login?error=no_code when no code param', async () => {
    const mock = createMockSupabaseClient()
    mockCreateClient.mockResolvedValue(mock as never)
    const req = new Request('http://localhost:3000/api/auth/callback')
    const res = await authCallback(req)
    expect(res.status).toBe(307) // redirect
    const location = res.headers.get('location')
    expect(location).toContain('/login')
    expect(location).toContain('error=no_code')
  })

  it('exchanges code and redirects to home', async () => {
    const mock = createMockSupabaseClient()
    mock.auth.exchangeCodeForSession.mockResolvedValue({
      data: {
        user: { id: 'u1', email: 'test@test.com', user_metadata: { full_name: 'Test' } },
        session: {},
      },
      error: null,
    })
    mockCreateClient.mockResolvedValue(mock as never)
    const req = new Request('http://localhost:3000/api/auth/callback?code=valid-code')
    const res = await authCallback(req)
    expect(res.status).toBe(307)
    const location = res.headers.get('location')
    expect(location).toContain('localhost:3000/')
  })

  it('redirects to login on auth error', async () => {
    const mock = createMockSupabaseClient()
    mock.auth.exchangeCodeForSession.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid code' },
    })
    mockCreateClient.mockResolvedValue(mock as never)
    const req = new Request('http://localhost:3000/api/auth/callback?code=bad-code')
    const res = await authCallback(req)
    expect(res.status).toBe(307)
    const location = res.headers.get('location')
    expect(location).toContain('error=auth_failed')
  })

  it('prevents open redirect via next param', async () => {
    const mock = createMockSupabaseClient()
    mock.auth.exchangeCodeForSession.mockResolvedValue({
      data: { user: { id: 'u1', email: 'test@test.com', user_metadata: {} }, session: {} },
      error: null,
    })
    mockCreateClient.mockResolvedValue(mock as never)
    const req = new Request('http://localhost:3000/api/auth/callback?code=valid&next=//evil.com')
    const res = await authCallback(req)
    const location = res.headers.get('location')
    expect(location).not.toContain('evil.com')
  })

  it('allows safe relative redirect via next param', async () => {
    const mock = createMockSupabaseClient()
    mock.auth.exchangeCodeForSession.mockResolvedValue({
      data: { user: { id: 'u1', email: 'test@test.com', user_metadata: {} }, session: {} },
      error: null,
    })
    mockCreateClient.mockResolvedValue(mock as never)
    const req = new Request('http://localhost:3000/api/auth/callback?code=valid&next=/profile')
    const res = await authCallback(req)
    const location = res.headers.get('location')
    expect(location).toContain('/profile')
  })

  it('upserts user profile on login', async () => {
    const mock = createMockSupabaseClient()
    mock.auth.exchangeCodeForSession.mockResolvedValue({
      data: {
        user: { id: 'u1', email: 'test@test.com', user_metadata: { full_name: 'Test User' } },
        session: {},
      },
      error: null,
    })
    mockCreateClient.mockResolvedValue(mock as never)
    const req = new Request('http://localhost:3000/api/auth/callback?code=valid')
    await authCallback(req)
    // Verify upsert was called
    expect(mock.from).toHaveBeenCalledWith('user_profiles')
  })

  it('handles encoded redirect in next param', async () => {
    const mock = createMockSupabaseClient()
    mock.auth.exchangeCodeForSession.mockResolvedValue({
      data: { user: { id: 'u1', email: 'test@test.com', user_metadata: {} }, session: {} },
      error: null,
    })
    mockCreateClient.mockResolvedValue(mock as never)
    const req = new Request('http://localhost:3000/api/auth/callback?code=valid&next=%2F%2Fevil.com')
    const res = await authCallback(req)
    const location = res.headers.get('location')
    expect(location).not.toContain('evil.com')
  })
})

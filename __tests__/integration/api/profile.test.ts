import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSupabaseClient } from '../../helpers/supabase-mock'
import { createGetRequest, parseResponseBody } from '../../helpers/request-mock'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/auth/middleware', () => ({
  requireAuth: vi.fn(),
}))

import { GET } from '@/app/api/profile/route'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/middleware'

const mockCreateClient = vi.mocked(createClient)
const mockRequireAuth = vi.mocked(requireAuth)

describe('GET /api/profile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with profile data', async () => {
    const mock = createMockSupabaseClient({
      data: { id: 'user-1', display_name: 'Researcher', tier: 'contributor', xp: 100 },
      error: null,
    })
    mockCreateClient.mockResolvedValue(mock as never)
    mockRequireAuth.mockResolvedValue({ id: 'user-1', email: 'test@test.com', user_metadata: {} })

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await parseResponseBody(res)
    expect(body.data).toHaveProperty('display_name')
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockResolvedValue(new Response(null, { status: 401 }))
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns default profile when no profile exists', async () => {
    const mock = createMockSupabaseClient({ data: null, error: { message: 'not found' } })
    mockCreateClient.mockResolvedValue(mock as never)
    mockRequireAuth.mockResolvedValue({
      id: 'user-1',
      email: 'test@test.com',
      user_metadata: { full_name: 'Test User' },
    })

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await parseResponseBody(res)
    expect(body.data.tier).toBe('contributor')
    expect(body.data.xp).toBe(0)
  })

  it('uses email prefix as fallback display name', async () => {
    const mock = createMockSupabaseClient({ data: null, error: { message: 'not found' } })
    mockCreateClient.mockResolvedValue(mock as never)
    mockRequireAuth.mockResolvedValue({
      id: 'user-1',
      email: 'john@example.com',
      user_metadata: {},
    })

    const res = await GET()
    const body = await parseResponseBody(res)
    expect(body.data.display_name).toBe('john')
  })

  it('returns response envelope', async () => {
    const mock = createMockSupabaseClient({ data: { id: 'user-1' }, error: null })
    mockCreateClient.mockResolvedValue(mock as never)
    mockRequireAuth.mockResolvedValue({ id: 'user-1', email: 'test@test.com', user_metadata: {} })

    const res = await GET()
    const body = await parseResponseBody(res)
    expect(body).toHaveProperty('data')
    expect(body).toHaveProperty('error')
    expect(body.error).toBeNull()
  })

  it('handles Supabase error gracefully with default profile', async () => {
    const mock = createMockSupabaseClient({ data: null, error: { message: 'DB down' } })
    mockCreateClient.mockResolvedValue(mock as never)
    mockRequireAuth.mockResolvedValue({
      id: 'user-1',
      email: 'test@test.com',
      user_metadata: {},
    })
    const res = await GET()
    expect(res.status).toBe(200) // Falls back to default profile
  })
})

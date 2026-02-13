import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSupabaseClient } from '../../helpers/supabase-mock'
import { createGetRequest, createPostRequest, createPatchRequest, parseResponseBody } from '../../helpers/request-mock'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/auth/middleware', () => ({
  requireAuth: vi.fn(),
  getUser: vi.fn(),
}))

import { GET as listThreads, POST as createThread } from '@/app/api/investigation-threads/route'
import { GET as getThread, PUT as updateThread, POST as addItem } from '@/app/api/investigation-threads/[id]/route'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, getUser } from '@/lib/auth/middleware'

const mockCreateClient = vi.mocked(createClient)
const mockRequireAuth = vi.mocked(requireAuth)
const mockGetUser = vi.mocked(getUser)
const UUID = '550e8400-e29b-41d4-a716-446655440000'

describe('GET /api/investigation-threads', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const mock = createMockSupabaseClient({ data: [], error: null, count: 0 })
    mockCreateClient.mockResolvedValue(mock as never)
  })

  it('returns 200 with paginated list', async () => {
    const req = createGetRequest('/api/investigation-threads')
    const res = await listThreads(req as never)
    expect(res.status).toBe(200)
  })

  it('returns paginated response shape', async () => {
    const req = createGetRequest('/api/investigation-threads')
    const res = await listThreads(req as never)
    const body = await parseResponseBody(res)
    expect(body).toHaveProperty('meta')
  })

  it('accepts tag filter', async () => {
    const req = createGetRequest('/api/investigation-threads', { tag: 'financial' })
    const res = await listThreads(req as never)
    expect(res.status).toBe(200)
  })

  it('handles Supabase error', async () => {
    const mock = createMockSupabaseClient({ data: null, error: { message: 'fail' }, count: 0 })
    mockCreateClient.mockResolvedValue(mock as never)
    const req = createGetRequest('/api/investigation-threads')
    const res = await listThreads(req as never)
    expect(res.status).toBe(500)
  })
})

describe('POST /api/investigation-threads', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const mock = createMockSupabaseClient({ data: { id: UUID, title: 'Test' }, error: null })
    mockCreateClient.mockResolvedValue(mock as never)
    mockRequireAuth.mockResolvedValue({ id: 'user-1', email: 'test@test.com', user_metadata: {} })
  })

  it('returns 200 with valid input', async () => {
    const req = createPostRequest('/api/investigation-threads', { title: 'New Thread' })
    const res = await createThread(req as never)
    expect(res.status).toBe(200)
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockResolvedValue(new Response(null, { status: 401 }))
    const req = createPostRequest('/api/investigation-threads', { title: 'New Thread' })
    const res = await createThread(req as never)
    expect(res.status).toBe(401)
  })

  it('returns 400 for empty title', async () => {
    const req = createPostRequest('/api/investigation-threads', { title: '' })
    const res = await createThread(req as never)
    expect(res.status).toBe(400)
  })

  it('handles Supabase insert error', async () => {
    const mock = createMockSupabaseClient({ data: null, error: { message: 'insert failed' } })
    mockCreateClient.mockResolvedValue(mock as never)
    const req = createPostRequest('/api/investigation-threads', { title: 'Test' })
    const res = await createThread(req as never)
    expect(res.status).toBe(500)
  })
})

describe('GET /api/investigation-threads/[id]', () => {
  const makeParams = (id: string) => ({ params: Promise.resolve({ id }) })

  beforeEach(() => {
    vi.clearAllMocks()
    const mock = createMockSupabaseClient({
      data: { id: UUID, title: 'Test Thread', is_public: true, user_id: 'user-1' },
      error: null,
    })
    mockCreateClient.mockResolvedValue(mock as never)
  })

  it('returns 200 for public thread', async () => {
    const req = createGetRequest(`/api/investigation-threads/${UUID}`)
    const res = await getThread(req as never, makeParams(UUID))
    expect(res.status).toBe(200)
  })

  it('returns 404 for non-existent thread', async () => {
    const mock = createMockSupabaseClient({ data: null, error: { message: 'not found' } })
    mockCreateClient.mockResolvedValue(mock as never)
    const req = createGetRequest(`/api/investigation-threads/${UUID}`)
    const res = await getThread(req as never, makeParams(UUID))
    expect(res.status).toBe(404)
  })

  it('returns thread with items', async () => {
    const req = createGetRequest(`/api/investigation-threads/${UUID}`)
    const res = await getThread(req as never, makeParams(UUID))
    const body = await parseResponseBody(res)
    expect(body.data).toHaveProperty('items')
  })
})

describe('PUT /api/investigation-threads/[id]', () => {
  const makeParams = (id: string) => ({ params: Promise.resolve({ id }) })

  beforeEach(() => {
    vi.clearAllMocks()
    const mock = createMockSupabaseClient({
      data: { user_id: 'user-1' },
      error: null,
    })
    mockCreateClient.mockResolvedValue(mock as never)
    mockRequireAuth.mockResolvedValue({ id: 'user-1', email: 'test@test.com', user_metadata: {} })
  })

  it('returns 200 with valid update', async () => {
    const req = createPatchRequest(`/api/investigation-threads/${UUID}`, { title: 'Updated' })
    // PUT handler
    const res = await updateThread(req as never, makeParams(UUID))
    expect(res.status).toBe(200)
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockResolvedValue(new Response(null, { status: 401 }))
    const req = createPatchRequest(`/api/investigation-threads/${UUID}`, { title: 'Updated' })
    const res = await updateThread(req as never, makeParams(UUID))
    expect(res.status).toBe(401)
  })

  it('returns 403 when not owner', async () => {
    const mock = createMockSupabaseClient({ data: { user_id: 'other-user' }, error: null })
    mockCreateClient.mockResolvedValue(mock as never)
    const req = createPatchRequest(`/api/investigation-threads/${UUID}`, { title: 'Updated' })
    const res = await updateThread(req as never, makeParams(UUID))
    expect(res.status).toBe(403)
  })
})

describe('POST /api/investigation-threads/[id] (add item)', () => {
  const makeParams = (id: string) => ({ params: Promise.resolve({ id }) })

  beforeEach(() => {
    vi.clearAllMocks()
    const mock = createMockSupabaseClient({
      data: { user_id: 'user-1', is_public: true },
      error: null,
      count: 0,
    })
    mockCreateClient.mockResolvedValue(mock as never)
    mockRequireAuth.mockResolvedValue({ id: 'user-1', email: 'test@test.com', user_metadata: {} })
  })

  it('returns 200 with valid item', async () => {
    const req = createPostRequest(`/api/investigation-threads/${UUID}`, {
      item_type: 'note',
      note: 'My note',
    })
    const res = await addItem(req as never, makeParams(UUID))
    expect(res.status).toBe(200)
  })

  it('returns 404 when thread not found', async () => {
    const mock = createMockSupabaseClient({ data: null, error: null, count: 0 })
    mockCreateClient.mockResolvedValue(mock as never)
    const req = createPostRequest(`/api/investigation-threads/${UUID}`, {
      item_type: 'note',
    })
    const res = await addItem(req as never, makeParams(UUID))
    expect(res.status).toBe(404)
  })

  it('returns 400 for invalid item_type', async () => {
    const req = createPostRequest(`/api/investigation-threads/${UUID}`, {
      item_type: 'invalid',
    })
    const res = await addItem(req as never, makeParams(UUID))
    expect(res.status).toBe(400)
  })
})

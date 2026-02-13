import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSupabaseClient } from '../../helpers/supabase-mock'
import { createGetRequest, parseResponseBody } from '../../helpers/request-mock'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { GET as listEntities } from '@/app/api/entity/route'
import { GET as getEntity } from '@/app/api/entity/[id]/route'
import { createClient } from '@/lib/supabase/server'

const mockCreateClient = vi.mocked(createClient)
const UUID = '550e8400-e29b-41d4-a716-446655440000'

describe('GET /api/entity (list)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const mock = createMockSupabaseClient({ data: [], error: null, count: 0 })
    mockCreateClient.mockResolvedValue(mock as never)
  })

  it('returns 200 with paginated list', async () => {
    const req = createGetRequest('/api/entity')
    const res = await listEntities(req as never)
    expect(res.status).toBe(200)
    const body = await parseResponseBody(res)
    expect(body).toHaveProperty('data')
    expect(body).toHaveProperty('meta')
  })

  it('respects page parameter', async () => {
    const req = createGetRequest('/api/entity', { page: '2', per_page: '10' })
    const res = await listEntities(req as never)
    expect(res.status).toBe(200)
  })

  it('accepts type filter', async () => {
    const req = createGetRequest('/api/entity', { type: 'person' })
    const res = await listEntities(req as never)
    expect(res.status).toBe(200)
  })

  it('handles Supabase error', async () => {
    const mock = createMockSupabaseClient({ data: null, error: { message: 'DB fail' }, count: 0 })
    mockCreateClient.mockResolvedValue(mock as never)
    const req = createGetRequest('/api/entity')
    const res = await listEntities(req as never)
    expect(res.status).toBe(500)
  })
})

describe('GET /api/entity/[id]', () => {
  const makeParams = (id: string) => ({ params: Promise.resolve({ id }) })

  function setupEntityMock(entity: Record<string, unknown> | null = { id: UUID, name: 'Jeffrey Epstein', entity_type: 'person' }) {
    const mock = createMockSupabaseClient({
      data: entity,
      error: entity ? null : { message: 'not found' },
    })
    // Route calls from('entities') then from('entity_relationships') then optionally from('entities') again
    // Use __setResults so sequential from() calls get correct shaped data
    mock.__setResults([
      { data: entity, error: entity ? null : { message: 'not found' } },
      { data: [], error: null },  // entity_relationships returns array
      { data: [], error: null },  // relatedEntities returns array
    ])
    // rpc returns array (mention stats)
    mock.rpc.mockImplementation(() => Promise.resolve({ data: [], error: null }))
    mockCreateClient.mockResolvedValue(mock as never)
    return mock
  }

  beforeEach(() => {
    vi.clearAllMocks()
    setupEntityMock()
  })

  it('returns 200 for valid UUID', async () => {
    const req = createGetRequest(`/api/entity/${UUID}`)
    const res = await getEntity(req as never, makeParams(UUID))
    expect(res.status).toBe(200)
  })

  it('returns 400 for non-UUID id', async () => {
    const req = createGetRequest('/api/entity/not-a-uuid')
    const res = await getEntity(req as never, makeParams('not-a-uuid'))
    expect(res.status).toBe(400)
  })

  it('returns 400 for SQL injection attempt', async () => {
    const req = createGetRequest('/api/entity/1%20OR%201=1')
    const res = await getEntity(req as never, makeParams('1 OR 1=1'))
    expect(res.status).toBe(400)
  })

  it('returns 404 when entity not found', async () => {
    setupEntityMock(null)
    const req = createGetRequest(`/api/entity/${UUID}`)
    const res = await getEntity(req as never, makeParams(UUID))
    expect(res.status).toBe(404)
  })

  it('includes related entities in response', async () => {
    setupEntityMock({ id: UUID, name: 'Test', entity_type: 'person' })
    const req = createGetRequest(`/api/entity/${UUID}`)
    const res = await getEntity(req as never, makeParams(UUID))
    expect(res.status).toBe(200)
    const body = await parseResponseBody(res)
    expect(body.data).toHaveProperty('related_entities')
  })

  it('returns response envelope', async () => {
    const req = createGetRequest(`/api/entity/${UUID}`)
    const res = await getEntity(req as never, makeParams(UUID))
    const body = await parseResponseBody(res)
    expect(body).toHaveProperty('data')
    expect(body).toHaveProperty('error')
  })

  it('rejects path traversal', async () => {
    const res = await getEntity(
      createGetRequest('/api/entity/../../etc/passwd') as never,
      makeParams('../../etc/passwd')
    )
    expect(res.status).toBe(400)
  })

  it('handles empty relationships gracefully', async () => {
    setupEntityMock({ id: UUID, name: 'Test', entity_type: 'person' })
    const req = createGetRequest(`/api/entity/${UUID}`)
    const res = await getEntity(req as never, makeParams(UUID))
    expect(res.status).toBe(200)
  })
})

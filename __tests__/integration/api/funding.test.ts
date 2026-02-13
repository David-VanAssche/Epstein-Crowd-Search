import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSupabaseClient } from '../../helpers/supabase-mock'
import { createGetRequest, parseResponseBody } from '../../helpers/request-mock'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { GET as getStatus } from '@/app/api/funding/status/route'
import { GET as getSpendLog } from '@/app/api/funding/spend-log/route'
import { GET as getImpact } from '@/app/api/funding/impact/route'
import { createClient } from '@/lib/supabase/server'

const mockCreateClient = vi.mocked(createClient)

describe('GET /api/funding/status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with funding data', async () => {
    const mock = createMockSupabaseClient({
      data: { raised_amount: 5000, goal_amount: 16000, donor_count: 42, updated_at: '2026-01-01' },
      error: null,
    })
    mockCreateClient.mockResolvedValue(mock as never)
    const res = await getStatus()
    expect(res.status).toBe(200)
    const body = await parseResponseBody(res)
    expect(body).toHaveProperty('raised')
    expect(body).toHaveProperty('goal')
    expect(body).toHaveProperty('percentage')
    expect(body).toHaveProperty('donor_count')
  })

  it('returns defaults when no data exists', async () => {
    const mock = createMockSupabaseClient({ data: null, error: { message: 'not found' } })
    mockCreateClient.mockResolvedValue(mock as never)
    const res = await getStatus()
    expect(res.status).toBe(200)
    const body = await parseResponseBody(res)
    expect(body.raised).toBe(0)
    expect(body.goal).toBe(16000)
    expect(body.percentage).toBe(0)
  })

  it('caps percentage at 100', async () => {
    const mock = createMockSupabaseClient({
      data: { raised_amount: 20000, goal_amount: 16000, donor_count: 100, updated_at: '2026-01-01' },
      error: null,
    })
    mockCreateClient.mockResolvedValue(mock as never)
    const res = await getStatus()
    const body = await parseResponseBody(res)
    expect(body.percentage).toBeLessThanOrEqual(100)
  })
})

describe('GET /api/funding/spend-log', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const mock = createMockSupabaseClient({ data: [], error: null, count: 0 })
    mockCreateClient.mockResolvedValue(mock as never)
  })

  it('returns 200 with paginated entries', async () => {
    const req = createGetRequest('/api/funding/spend-log')
    const res = await getSpendLog(req as never)
    expect(res.status).toBe(200)
    const body = await parseResponseBody(res)
    expect(body).toHaveProperty('entries')
    expect(body).toHaveProperty('total')
    expect(body).toHaveProperty('page')
  })

  it('accepts page parameter', async () => {
    const req = createGetRequest('/api/funding/spend-log', { page: '2' })
    const res = await getSpendLog(req as never)
    expect(res.status).toBe(200)
  })

  it('accepts service filter', async () => {
    const req = createGetRequest('/api/funding/spend-log', { service: 'openai' })
    const res = await getSpendLog(req as never)
    expect(res.status).toBe(200)
  })

  it('returns 400 for invalid service', async () => {
    const req = createGetRequest('/api/funding/spend-log', { service: 'invalid_service' })
    const res = await getSpendLog(req as never)
    expect(res.status).toBe(400)
  })

  it('accepts date range filters', async () => {
    const req = createGetRequest('/api/funding/spend-log', {
      date_from: '2026-01-01',
      date_to: '2026-02-01',
    })
    const res = await getSpendLog(req as never)
    expect(res.status).toBe(200)
  })

  it('handles Supabase error gracefully', async () => {
    const mock = createMockSupabaseClient({ data: null, error: { message: 'fail' }, count: 0 })
    mockCreateClient.mockResolvedValue(mock as never)
    const req = createGetRequest('/api/funding/spend-log')
    const res = await getSpendLog(req as never)
    expect(res.status).toBe(200) // Falls back to empty
    const body = await parseResponseBody(res)
    expect(body.entries).toEqual([])
  })
})

describe('GET /api/funding/impact', () => {
  it('returns 200 with valid amount', async () => {
    const req = createGetRequest('/api/funding/impact', { amount: '10' })
    const res = await getImpact(req as never)
    expect(res.status).toBe(200)
    const body = await parseResponseBody(res)
    expect(body).toHaveProperty('pages')
    expect(body).toHaveProperty('entities_estimated')
    expect(body).toHaveProperty('analogy')
  })

  it('returns 400 for zero amount', async () => {
    const req = createGetRequest('/api/funding/impact', { amount: '0' })
    const res = await getImpact(req as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 for negative amount', async () => {
    const req = createGetRequest('/api/funding/impact', { amount: '-5' })
    const res = await getImpact(req as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 for missing amount', async () => {
    const req = createGetRequest('/api/funding/impact')
    const res = await getImpact(req as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 for amount over 1M', async () => {
    const req = createGetRequest('/api/funding/impact', { amount: '1000001' })
    const res = await getImpact(req as never)
    expect(res.status).toBe(400)
  })

  it('returns appropriate analogy for $1', async () => {
    const req = createGetRequest('/api/funding/impact', { amount: '1' })
    const res = await getImpact(req as never)
    const body = await parseResponseBody(res)
    expect(body.analogy).toContain('FBI interview')
  })

  it('returns appropriate analogy for $5000', async () => {
    const req = createGetRequest('/api/funding/impact', { amount: '5000' })
    const res = await getImpact(req as never)
    const body = await parseResponseBody(res)
    expect(body.analogy).toContain('entire Epstein')
  })

  it('returns cost_per_page in response', async () => {
    const req = createGetRequest('/api/funding/impact', { amount: '10' })
    const res = await getImpact(req as never)
    const body = await parseResponseBody(res)
    expect(body).toHaveProperty('cost_per_page')
    expect(body.cost_per_page).toBeGreaterThan(0)
  })
})

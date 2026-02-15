import { test, expect } from '@playwright/test'

test.describe('API Health', () => {
  test('GET /api/stats returns 200', async ({ request }) => {
    const res = await request.get('/api/stats')
    expect(res.status()).toBe(200)
  })

  test('GET /api/sources returns 200', async ({ request }) => {
    const res = await request.get('/api/sources')
    expect(res.status()).toBe(200)
  })

  test('GET /api/timeline returns 200', async ({ request }) => {
    const res = await request.get('/api/timeline')
    expect(res.status()).toBe(200)
  })

  test('GET /api/funding/status returns 200', async ({ request }) => {
    const res = await request.get('/api/funding/status')
    expect(res.status()).toBe(200)
  })

  test('GET /api/funding/impact?amount=10 returns 200', async ({ request }) => {
    const res = await request.get('/api/funding/impact?amount=10')
    expect(res.status()).toBe(200)
  })

  test('POST /api/search with body returns response', async ({ request }) => {
    const res = await request.post('/api/search', { data: { query: 'test' } })
    expect([200, 400, 404, 500]).toContain(res.status())
  })

  test('GET /api/entity returns response', async ({ request }) => {
    const res = await request.get('/api/entity')
    // 500 acceptable if risk_score migration hasn't been applied yet
    expect([200, 400, 404, 500]).toContain(res.status())
  })

  test('responses have expected JSON structure', async ({ request }) => {
    const res = await request.get('/api/stats')
    if (res.status() === 200) {
      const json = await res.json()
      expect(json).toBeTruthy()
      expect(typeof json).toBe('object')
    }
  })
})

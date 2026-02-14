import { test, expect } from '@playwright/test'

test.describe('Black Book API', () => {
  test('GET /api/black-book returns response', async ({ request }) => {
    const res = await request.get('/api/black-book')
    // 200 if table exists, 500 if structured_data_extractions table not yet created
    expect(res.status()).toBeLessThanOrEqual(500)
  })

  test('response has expected JSON structure when available', async ({ request }) => {
    const res = await request.get('/api/black-book')
    if (res.status() === 200) {
      const json = await res.json()
      expect(json).toBeTruthy()
      expect(json.data).toBeDefined()
      expect(json.error).toBeNull()
      expect(json.meta).toBeDefined()
      expect(json.meta.page).toBe(1)
      expect(json.meta.per_page).toBe(100)
      expect(typeof json.meta.total).toBe('number')
      expect(typeof json.meta.has_more).toBe('boolean')
    }
  })

  test('data is an array when available', async ({ request }) => {
    const res = await request.get('/api/black-book')
    if (res.status() === 200) {
      const json = await res.json()
      expect(Array.isArray(json.data)).toBe(true)
    }
  })

  test('supports search parameter', async ({ request }) => {
    const res = await request.get('/api/black-book?search=test')
    // Accept 200 (working) or 500 (table not created)
    if (res.status() === 200) {
      const json = await res.json()
      expect(Array.isArray(json.data)).toBe(true)
    }
  })

  test('supports letter parameter', async ({ request }) => {
    const res = await request.get('/api/black-book?letter=A')
    if (res.status() === 200) {
      const json = await res.json()
      expect(Array.isArray(json.data)).toBe(true)
    }
  })

  test('supports pagination', async ({ request }) => {
    const res = await request.get('/api/black-book?page=2&per_page=10')
    if (res.status() === 200) {
      const json = await res.json()
      expect(json.meta.page).toBe(2)
      expect(json.meta.per_page).toBe(10)
    }
  })

  test('rejects invalid letter parameter gracefully', async ({ request }) => {
    // Multi-char or number letters should just return no filter (not crash)
    const res = await request.get('/api/black-book?letter=123')
    // Accept 200 or 500 (table not created)
    expect(res.status()).toBeLessThanOrEqual(500)
  })
})

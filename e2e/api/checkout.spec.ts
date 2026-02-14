import { test, expect } from '@playwright/test'

test.describe('Checkout API', () => {
  test.describe('POST /api/checkout — input validation', () => {
    test('rejects missing amount_cents', async ({ request }) => {
      const res = await request.post('/api/checkout', {
        data: { campaign_slug: 'flights' },
      })
      expect(res.status()).toBe(400)
      const json = await res.json()
      expect(json.error).toBeTruthy()
    })

    test('rejects amount below $1 (under 100 cents)', async ({ request }) => {
      const res = await request.post('/api/checkout', {
        data: { campaign_slug: 'flights', amount_cents: 50 },
      })
      expect(res.status()).toBe(400)
      const json = await res.json()
      expect(json.error).toContain('$1')
    })

    test('rejects amount above $10,000 (over 1000000 cents)', async ({ request }) => {
      const res = await request.post('/api/checkout', {
        data: { campaign_slug: 'flights', amount_cents: 2_000_000 },
      })
      expect(res.status()).toBe(400)
      const json = await res.json()
      expect(json.error).toContain('$10,000')
    })

    test('rejects non-integer amount', async ({ request }) => {
      const res = await request.post('/api/checkout', {
        data: { campaign_slug: 'flights', amount_cents: 2500.50 },
      })
      expect(res.status()).toBe(400)
      const json = await res.json()
      expect(json.error).toContain('integer')
    })

    test('rejects zero amount', async ({ request }) => {
      const res = await request.post('/api/checkout', {
        data: { campaign_slug: 'flights', amount_cents: 0 },
      })
      expect(res.status()).toBe(400)
    })

    test('rejects negative amount', async ({ request }) => {
      const res = await request.post('/api/checkout', {
        data: { campaign_slug: 'flights', amount_cents: -500 },
      })
      expect(res.status()).toBe(400)
    })
  })

  test.describe('POST /api/checkout — boundary values', () => {
    test('accepts exactly $1 (100 cents) — may fail without Stripe key', async ({ request }) => {
      const res = await request.post('/api/checkout', {
        data: { campaign_slug: 'general', amount_cents: 100 },
      })
      // 200 if Stripe is configured, 500 if not (past validation)
      // Should NOT be 400 — that means validation rejected a valid amount
      expect(res.status()).not.toBe(400)
    })

    test('accepts exactly $10,000 (1000000 cents) — may fail without Stripe key', async ({ request }) => {
      const res = await request.post('/api/checkout', {
        data: { campaign_slug: 'general', amount_cents: 1_000_000 },
      })
      expect(res.status()).not.toBe(400)
    })
  })

  test.describe('POST /api/webhooks/stripe', () => {
    test('rejects request without stripe-signature header', async ({ request }) => {
      const res = await request.post('/api/webhooks/stripe', {
        data: '{}',
        headers: { 'Content-Type': 'application/json' },
      })
      expect(res.status()).toBe(400)
      const json = await res.json()
      expect(json.error).toContain('signature')
    })

    test('rejects request with invalid signature', async ({ request }) => {
      const res = await request.post('/api/webhooks/stripe', {
        data: '{"type": "checkout.session.completed"}',
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': 't=999999999,v1=invalid_signature_here',
        },
      })
      // 400 (bad sig) or 500 (no webhook secret configured)
      expect([400, 500]).toContain(res.status())
    })
  })
})

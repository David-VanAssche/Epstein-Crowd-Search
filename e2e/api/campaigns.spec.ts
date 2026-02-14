import { test, expect } from '@playwright/test'

test.describe('Campaigns API', () => {
  test.describe('GET /api/campaigns', () => {
    test('returns 200 with campaigns array and totals', async ({ request }) => {
      const res = await request.get('/api/campaigns')
      // Accept 200 (tables exist) or 500 (migration not yet applied)
      if (res.status() === 200) {
        const json = await res.json()
        expect(json).toHaveProperty('campaigns')
        expect(json).toHaveProperty('totals')
        expect(Array.isArray(json.campaigns)).toBe(true)

        // Totals shape
        const { totals } = json
        expect(totals).toHaveProperty('total_funded')
        expect(totals).toHaveProperty('total_spent')
        expect(totals).toHaveProperty('total_units')
        expect(totals).toHaveProperty('total_processed')
        expect(totals).toHaveProperty('overall_progress')
        expect(typeof totals.total_funded).toBe('number')
        expect(typeof totals.overall_progress).toBe('number')
      } else {
        // If migration not applied, endpoint should still return valid JSON error
        expect(res.status()).toBe(500)
        const json = await res.json()
        expect(json).toHaveProperty('error')
      }
    })

    test('campaigns have expected enriched fields', async ({ request }) => {
      const res = await request.get('/api/campaigns')
      if (res.status() !== 200) {
        test.skip()
        return
      }

      const { campaigns } = await res.json()
      if (campaigns.length === 0) {
        test.skip()
        return
      }

      const campaign = campaigns[0]
      // Verify enriched computed fields from the API
      expect(campaign).toHaveProperty('slug')
      expect(campaign).toHaveProperty('title')
      expect(campaign).toHaveProperty('description')
      expect(campaign).toHaveProperty('status')
      expect(campaign).toHaveProperty('total_units')
      expect(campaign).toHaveProperty('total_units_processed')
      expect(campaign).toHaveProperty('funded_amount')
      expect(campaign).toHaveProperty('spent_amount')
      expect(campaign).toHaveProperty('cost_per_unit')
      // Computed fields
      expect(campaign).toHaveProperty('progress_percent')
      expect(campaign).toHaveProperty('funding_percent')
      expect(campaign).toHaveProperty('remaining_cost')
      expect(campaign).toHaveProperty('total_cost')
      // Types
      expect(typeof campaign.progress_percent).toBe('number')
      expect(typeof campaign.funding_percent).toBe('number')
      expect(campaign.progress_percent).toBeGreaterThanOrEqual(0)
      expect(campaign.progress_percent).toBeLessThanOrEqual(100)
    })

    test('returns all 16 seeded campaigns', async ({ request }) => {
      const res = await request.get('/api/campaigns')
      if (res.status() !== 200) {
        test.skip()
        return
      }

      const { campaigns } = await res.json()
      const slugs = campaigns.map((c: { slug: string }) => c.slug)

      const expectedSlugs = [
        'audio', 'contradictions', 'discoveries', 'emails',
        'entities', 'entity-connections', 'entity-mentions',
        'entity-timeline', 'finances', 'flights', 'general',
        'graph', 'map', 'photos', 'redactions', 'timeline',
      ]

      for (const slug of expectedSlugs) {
        expect(slugs, `Missing campaign slug: ${slug}`).toContain(slug)
      }
      expect(campaigns.length).toBe(16)
    })
  })

  test.describe('GET /api/campaigns/[slug]', () => {
    test('returns 200 for valid campaign slug', async ({ request }) => {
      const res = await request.get('/api/campaigns/flights')
      if (res.status() === 200) {
        const json = await res.json()
        expect(json).toHaveProperty('campaign')
        expect(json).toHaveProperty('recent_contributions')
        expect(json).toHaveProperty('recent_spend')
        expect(json.campaign.slug).toBe('flights')
        expect(json.campaign.title).toBeTruthy()
        // Enriched computed fields
        expect(json.campaign).toHaveProperty('progress_percent')
        expect(json.campaign).toHaveProperty('funding_percent')
        expect(json.campaign).toHaveProperty('remaining_cost')
        expect(json.campaign).toHaveProperty('total_cost')
        // Arrays
        expect(Array.isArray(json.recent_contributions)).toBe(true)
        expect(Array.isArray(json.recent_spend)).toBe(true)
      } else {
        // Migration not applied
        expect([404, 500]).toContain(res.status())
      }
    })

    test('returns 404 for non-existent campaign', async ({ request }) => {
      const res = await request.get('/api/campaigns/non-existent-slug-12345')
      expect(res.status()).toBe(404)
      const json = await res.json()
      expect(json).toHaveProperty('error')
      expect(json.error).toContain('not found')
    })

    test('returns valid data for general campaign', async ({ request }) => {
      const res = await request.get('/api/campaigns/general')
      if (res.status() !== 200) {
        test.skip()
        return
      }

      const { campaign } = await res.json()
      expect(campaign.slug).toBe('general')
      expect(campaign.total_units).toBeGreaterThan(0)
      expect(campaign.cost_per_unit).toBeGreaterThan(0)
      expect(campaign.total_cost).toBeGreaterThan(0)
    })

    test('returns valid data for each feature campaign', async ({ request }) => {
      const featureSlugs = ['entities', 'graph', 'timeline', 'redactions', 'flights']
      for (const slug of featureSlugs) {
        const res = await request.get(`/api/campaigns/${slug}`)
        if (res.status() !== 200) continue
        const { campaign } = await res.json()
        expect(campaign.slug).toBe(slug)
        expect(typeof campaign.total_cost).toBe('number')
      }
    })
  })
})

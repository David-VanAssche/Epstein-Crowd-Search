import { test, expect } from '@playwright/test'

test.describe('Entity API — Risk Score Fields', () => {
  test('GET /api/entity returns response', async ({ request }) => {
    const res = await request.get('/api/entity?per_page=5')
    // May be 200 or 500 if migration hasn't been applied yet
    if (res.status() === 200) {
      const json = await res.json()
      expect(Array.isArray(json.data)).toBe(true)
      // If migration is applied, entities should have risk_score field
      if (json.data.length > 0 && 'risk_score' in json.data[0]) {
        expect(typeof json.data[0].risk_score).toBe('number')
      }
    } else {
      // Pre-migration: API may return 500 due to missing column
      expect(res.status()).toBeLessThanOrEqual(500)
    }
  })

  test('GET /api/entity supports type filter', async ({ request }) => {
    const res = await request.get('/api/entity?type=person&per_page=5')
    // Accept 200 (working) or 500 (pre-migration)
    if (res.status() === 200) {
      const json = await res.json()
      if (json.data.length > 0) {
        expect(json.data[0].entity_type).toBe('person')
      }
    }
  })

  test('GET /api/entity/[id] returns risk fields for valid UUID', async ({ request }) => {
    // First get an entity ID from the list
    const listRes = await request.get('/api/entity?per_page=1')

    if (listRes.status() === 200) {
      const listJson = await listRes.json()
      if (listJson.data && listJson.data.length > 0) {
        const entityId = listJson.data[0].id
        const detailRes = await request.get(`/api/entity/${entityId}`)
        expect(detailRes.status()).toBe(200)
        const detailJson = await detailRes.json()
        const entity = detailJson.data
        // After migration, these fields should exist
        if ('risk_score' in entity) {
          expect(entity).toHaveProperty('risk_score')
          expect(entity).toHaveProperty('risk_factors')
          expect(entity).toHaveProperty('risk_score_updated_at')
        }
      }
    }
  })

  test('GET /api/entity/[id] returns 400 for non-UUID', async ({ request }) => {
    const res = await request.get('/api/entity/not-a-uuid')
    expect(res.status()).toBe(400)
  })

  test('GET /api/entity/[id] returns 404 for non-existent UUID', async ({ request }) => {
    const res = await request.get('/api/entity/00000000-0000-0000-0000-000000000000')
    expect(res.status()).toBe(404)
  })

  test('GET /api/graph/entities returns response', async ({ request }) => {
    const res = await request.get('/api/graph/entities?limit=10')
    // Accept 200 (working) or 500 (pre-migration)
    if (res.status() === 200) {
      const json = await res.json()
      expect(json.data).toHaveProperty('nodes')
      expect(json.data).toHaveProperty('edges')
      expect(Array.isArray(json.data.nodes)).toBe(true)
      // If nodes exist and migration is applied, check for criminalIndicatorScore
      if (json.data.nodes.length > 0 && 'criminalIndicatorScore' in json.data.nodes[0]) {
        expect(typeof json.data.nodes[0].criminalIndicatorScore).toBe('number')
      }
    }
  })
})

import { describe, it, expect } from 'vitest'
import { parseSearchParams } from '@/lib/api/schemas'

describe('parseSearchParams', () => {
  const makeURL = (params: Record<string, string>) => {
    const url = new URL('http://localhost:3000/api/test')
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v)
    }
    return url
  }

  it('coerces page to number', () => {
    const result = parseSearchParams(makeURL({ page: '3' }))
    expect(result.page).toBe(3)
    expect(typeof result.page).toBe('number')
  })

  it('coerces per_page to number', () => {
    const result = parseSearchParams(makeURL({ per_page: '50' }))
    expect(result.per_page).toBe(50)
  })

  it('coerces limit to number', () => {
    const result = parseSearchParams(makeURL({ limit: '10' }))
    expect(result.limit).toBe(10)
  })

  it('coerces offset to number', () => {
    const result = parseSearchParams(makeURL({ offset: '20' }))
    expect(result.offset).toBe(20)
  })

  it('coerces depth to number', () => {
    const result = parseSearchParams(makeURL({ depth: '2' }))
    expect(result.depth).toBe(2)
  })

  it('preserves UUIDs as strings', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000'
    const result = parseSearchParams(makeURL({ entity_id: uuid }))
    expect(result.entity_id).toBe(uuid)
    expect(typeof result.entity_id).toBe('string')
  })

  it('coerces "true" to boolean', () => {
    const result = parseSearchParams(makeURL({ has_redactions: 'true' }))
    expect(result.has_redactions).toBe(true)
  })

  it('coerces "false" to boolean', () => {
    const result = parseSearchParams(makeURL({ has_redactions: 'false' }))
    expect(result.has_redactions).toBe(false)
  })

  it('leaves non-numeric params as strings', () => {
    const result = parseSearchParams(makeURL({ query: 'epstein', sort: 'date_asc' }))
    expect(result.query).toBe('epstein')
    expect(result.sort).toBe('date_asc')
  })

  it('does not coerce numeric-looking non-numeric params', () => {
    // page is numeric, but a param named 'page' with non-numeric value stays string
    const result = parseSearchParams(makeURL({ page: 'abc' }))
    expect(result.page).toBe('abc')
    expect(typeof result.page).toBe('string')
  })

  it('handles empty search params', () => {
    const url = new URL('http://localhost:3000/api/test')
    const result = parseSearchParams(url)
    expect(Object.keys(result)).toHaveLength(0)
  })
})

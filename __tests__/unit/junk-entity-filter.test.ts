import { describe, it, expect } from 'vitest'
import { isJunkEntity } from '@/lib/utils/junk-entity-filter'

describe('isJunkEntity', () => {
  // Should be junk
  it('rejects empty string', () => {
    expect(isJunkEntity('')).toBe(true)
  })

  it('rejects single character', () => {
    expect(isJunkEntity('A')).toBe(true)
    expect(isJunkEntity('x')).toBe(true)
  })

  it('rejects day names', () => {
    expect(isJunkEntity('Monday')).toBe(true)
    expect(isJunkEntity('FRIDAY')).toBe(true)
    expect(isJunkEntity('sunday')).toBe(true)
  })

  it('rejects month names', () => {
    expect(isJunkEntity('January')).toBe(true)
    expect(isJunkEntity('DECEMBER')).toBe(true)
  })

  it('rejects document boilerplate', () => {
    expect(isJunkEntity('United States District Court')).toBe(true)
    expect(isJunkEntity('Plaintiff')).toBe(true)
    expect(isJunkEntity('Defendant')).toBe(true)
    expect(isJunkEntity('Deposition')).toBe(true)
    expect(isJunkEntity('EXHIBIT')).toBe(true)
  })

  it('rejects pure numbers', () => {
    expect(isJunkEntity('12345')).toBe(true)
    expect(isJunkEntity('2024')).toBe(true)
  })

  it('rejects date-like patterns', () => {
    expect(isJunkEntity('01/15/2023')).toBe(true)
    expect(isJunkEntity('2023-01-15')).toBe(true)
  })

  it('rejects generic words', () => {
    expect(isJunkEntity('Unknown')).toBe(true)
    expect(isJunkEntity('John Doe')).toBe(true)
    expect(isJunkEntity('N/A')).toBe(true)
    expect(isJunkEntity('None')).toBe(true)
  })

  it('rejects HTML/CSS terms', () => {
    expect(isJunkEntity('Arial')).toBe(true)
    expect(isJunkEntity('div')).toBe(true)
    expect(isJunkEntity('span')).toBe(true)
  })

  it('rejects common short words', () => {
    expect(isJunkEntity('the')).toBe(true)
    expect(isJunkEntity('Mr')).toBe(true)
    expect(isJunkEntity('Dr')).toBe(true)
    expect(isJunkEntity('no')).toBe(true)
    expect(isJunkEntity('or')).toBe(true)
  })

  it('rejects corporate suffixes', () => {
    expect(isJunkEntity('LLC')).toBe(true)
    expect(isJunkEntity('Inc')).toBe(true)
    expect(isJunkEntity('Corp')).toBe(true)
  })

  // Should NOT be junk
  it('accepts real person names', () => {
    expect(isJunkEntity('Jeffrey Epstein')).toBe(false)
    expect(isJunkEntity('Ghislaine Maxwell')).toBe(false)
    expect(isJunkEntity('Alan Dershowitz')).toBe(false)
  })

  it('accepts organization names', () => {
    expect(isJunkEntity('JPMorgan Chase')).toBe(false)
    expect(isJunkEntity('Deutsche Bank')).toBe(false)
  })

  it('accepts location names', () => {
    expect(isJunkEntity('Little St. James')).toBe(false)
    expect(isJunkEntity('Palm Beach')).toBe(false)
  })

  it('accepts aircraft identifiers', () => {
    expect(isJunkEntity('N908JE')).toBe(false)
  })

  it('accepts multi-word titles that are not in blocklist', () => {
    expect(isJunkEntity('FBI Miami Field Office')).toBe(false)
  })
})

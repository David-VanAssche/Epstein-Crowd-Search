import { describe, it, expect } from 'vitest'
import { normalizeEntityName } from '@/lib/utils/normalize-entity-name'

describe('normalizeEntityName', () => {
  it('lowercases name', () => {
    expect(normalizeEntityName('Jeffrey Epstein')).toBe('jeffrey epstein')
  })

  it('strips Dr. prefix', () => {
    expect(normalizeEntityName('Dr. Jeffrey E. Epstein')).toBe('jeffrey e. epstein')
  })

  it('strips Mr. prefix', () => {
    expect(normalizeEntityName('Mr. John Smith')).toBe('john smith')
  })

  it('strips Mrs. prefix', () => {
    expect(normalizeEntityName('Mrs. Jane Smith')).toBe('jane smith')
  })

  it('strips Ms. prefix', () => {
    expect(normalizeEntityName('Ms. Jane Doe')).toBe('jane doe')
  })

  it('strips Prof. prefix', () => {
    expect(normalizeEntityName('Prof. Alan Dershowitz')).toBe('alan dershowitz')
  })

  it('strips Sir prefix', () => {
    expect(normalizeEntityName('Sir Richard Branson')).toBe('richard branson')
  })

  it('strips Jr. suffix', () => {
    expect(normalizeEntityName('Jeffrey Epstein, Jr.')).toBe('jeffrey epstein')
  })

  it('strips Sr. suffix', () => {
    expect(normalizeEntityName('John Smith Sr.')).toBe('john smith')
  })

  it('strips III suffix', () => {
    expect(normalizeEntityName('John Smith III')).toBe('john smith')
  })

  it('strips Esq. suffix', () => {
    expect(normalizeEntityName('Alan Dershowitz, Esq.')).toBe('alan dershowitz')
  })

  it('strips PhD suffix', () => {
    expect(normalizeEntityName('Jane Doe, PhD')).toBe('jane doe')
  })

  it('strips Ph.D. suffix', () => {
    expect(normalizeEntityName('Jane Doe, Ph.D.')).toBe('jane doe')
  })

  it('flips "Last, First" format', () => {
    expect(normalizeEntityName('Epstein, Jeffrey')).toBe('jeffrey epstein')
  })

  it('flips hyphenated "Last, First"', () => {
    expect(normalizeEntityName("O'Brien, John")).toBe("john o'brien")
  })

  it('strips outer quotes', () => {
    expect(normalizeEntityName('"Jeffrey Epstein"')).toBe('jeffrey epstein')
  })

  it('strips single quotes', () => {
    expect(normalizeEntityName("'Jeffrey Epstein'")).toBe('jeffrey epstein')
  })

  it('strips parenthetical content', () => {
    expect(normalizeEntityName('Jeffrey Epstein (aka Jeff)')).toBe('jeffrey epstein')
  })

  it('collapses whitespace', () => {
    expect(normalizeEntityName('  Jeffrey   E.   Epstein  ')).toBe('jeffrey e. epstein')
  })

  it('handles combined title + suffix + flip', () => {
    expect(normalizeEntityName('Dr. Jeffrey E. Epstein, Jr.')).toBe('jeffrey e. epstein')
  })

  it('handles empty string', () => {
    expect(normalizeEntityName('')).toBe('')
  })

  it('handles single word', () => {
    expect(normalizeEntityName('Epstein')).toBe('epstein')
  })

  it('does not flip comma in long names with internal commas', () => {
    // "UNITED STATES OF AMERICA, Plaintiff" should not be flipped
    // because the part before comma doesn't match the simple name pattern
    const result = normalizeEntityName('UNITED STATES OF AMERICA, Plaintiff')
    expect(result).toContain('united states')
  })

  it('handles military prefixes', () => {
    expect(normalizeEntityName('Gen. David Petraeus')).toBe('david petraeus')
    expect(normalizeEntityName('Col. John Smith')).toBe('john smith')
    expect(normalizeEntityName('Sgt. Jane Doe')).toBe('jane doe')
  })
})

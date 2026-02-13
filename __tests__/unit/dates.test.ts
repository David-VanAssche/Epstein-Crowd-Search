import { describe, it, expect } from 'vitest'
import {
  parseOCRDate,
  getDatePrecision,
  displayDate,
  formatDateRange,
} from '@/lib/utils/dates'

describe('parseOCRDate', () => {
  describe('ISO format', () => {
    it('parses "2003-04-15"', () => {
      const d = parseOCRDate('2003-04-15')
      expect(d).not.toBeNull()
      expect(d!.getFullYear()).toBe(2003)
      expect(d!.getMonth()).toBe(3) // April = 3
      expect(d!.getDate()).toBe(15)
    })

    it('parses ISO with trailing timestamp', () => {
      const d = parseOCRDate('2003-04-15T00:00:00Z')
      expect(d).not.toBeNull()
      expect(d!.getFullYear()).toBe(2003)
    })
  })

  describe('US format', () => {
    it('parses "04/15/2003"', () => {
      const d = parseOCRDate('04/15/2003')
      expect(d).not.toBeNull()
      expect(d!.getFullYear()).toBe(2003)
      expect(d!.getMonth()).toBe(3)
      expect(d!.getDate()).toBe(15)
    })

    it('parses short year "4/15/03" (<=50 -> 2000)', () => {
      const d = parseOCRDate('4/15/03')
      expect(d).not.toBeNull()
      expect(d!.getFullYear()).toBe(2003)
    })

    it('2-digit year boundary: 50 -> 2050', () => {
      const d = parseOCRDate('1/1/50')
      expect(d).not.toBeNull()
      expect(d!.getFullYear()).toBe(2050)
    })

    it('2-digit year boundary: 51 -> 1951', () => {
      const d = parseOCRDate('1/1/51')
      expect(d).not.toBeNull()
      expect(d!.getFullYear()).toBe(1951)
    })

    it('parses single-digit month and day', () => {
      const d = parseOCRDate('1/2/2000')
      expect(d).not.toBeNull()
      expect(d!.getMonth()).toBe(0) // January
      expect(d!.getDate()).toBe(2)
    })
  })

  describe('Written format', () => {
    it('parses "April 15, 2003"', () => {
      const d = parseOCRDate('April 15, 2003')
      expect(d).not.toBeNull()
      expect(d!.getFullYear()).toBe(2003)
    })

    it('parses abbreviated "Apr 15, 2003"', () => {
      const d = parseOCRDate('Apr 15, 2003')
      expect(d).not.toBeNull()
    })

    it('parses without comma "April 15 2003"', () => {
      const d = parseOCRDate('April 15 2003')
      expect(d).not.toBeNull()
    })

    it('parses January', () => {
      const d = parseOCRDate('January 1, 2000')
      expect(d).not.toBeNull()
      expect(d!.getFullYear()).toBe(2000)
    })
  })

  describe('Year only', () => {
    it('parses "2003" as Jan 1, 2003', () => {
      const d = parseOCRDate('2003')
      expect(d).not.toBeNull()
      expect(d!.getFullYear()).toBe(2003)
      expect(d!.getMonth()).toBe(0)
      expect(d!.getDate()).toBe(1)
    })
  })

  describe('Failures', () => {
    it('returns null for empty string', () => {
      expect(parseOCRDate('')).toBeNull()
    })

    it('returns null for random text', () => {
      expect(parseOCRDate('not a date')).toBeNull()
    })

    it('returns null for month+year without day', () => {
      expect(parseOCRDate('April 2003')).toBeNull()
    })

    it('handles leading/trailing whitespace', () => {
      const d = parseOCRDate('  2003-04-15  ')
      expect(d).not.toBeNull()
    })
  })
})

describe('getDatePrecision', () => {
  it('returns "year" for 4-digit year', () => {
    expect(getDatePrecision('2003')).toBe('year')
  })

  it('returns "month" for full month + year', () => {
    expect(getDatePrecision('January 2003')).toBe('month')
  })

  it('returns "month" for abbreviated month + year', () => {
    expect(getDatePrecision('Jan 2003')).toBe('month')
  })

  it('returns "approximate" for "circa"', () => {
    expect(getDatePrecision('circa 2003')).toBe('approximate')
  })

  it('returns "approximate" for "~"', () => {
    expect(getDatePrecision('~2003')).toBe('approximate')
  })

  it('returns "approximate" for "approx"', () => {
    expect(getDatePrecision('approx 2003')).toBe('approximate')
  })

  it('returns "approximate" for "around"', () => {
    expect(getDatePrecision('around 2003')).toBe('approximate')
  })

  it('returns "approximate" for "about"', () => {
    expect(getDatePrecision('about 2003')).toBe('approximate')
  })

  it('returns "approximate" for "?"', () => {
    expect(getDatePrecision('2003?')).toBe('approximate')
  })

  it('returns "exact" for ISO date', () => {
    expect(getDatePrecision('2003-04-15')).toBe('exact')
  })

  it('returns "day" for other formats (default)', () => {
    expect(getDatePrecision('April 15, 2003')).toBe('day')
  })
})

describe('displayDate', () => {
  it('returns "Unknown date" for null', () => {
    expect(displayDate(null)).toBe('Unknown date')
  })

  it('returns "Invalid date" for NaN date', () => {
    expect(displayDate('not-a-date')).toBe('Invalid date')
  })

  it('displays year precision', () => {
    expect(displayDate('2003-06-15', 'year')).toBe('2003')
  })

  it('displays month precision', () => {
    const result = displayDate('2003-06-15', 'month')
    expect(result).toContain('June')
    expect(result).toContain('2003')
  })

  it('displays approximate precision', () => {
    expect(displayDate('2003-06-15', 'approximate')).toBe('c. 2003')
  })

  it('displays day/default precision', () => {
    const result = displayDate('2003-06-15', 'day')
    expect(result).toContain('June')
    expect(result).toContain('15')
    expect(result).toContain('2003')
  })

  it('displays exact precision same as day', () => {
    const result = displayDate('2003-06-15', 'exact')
    expect(result).toContain('June')
    expect(result).toContain('2003')
  })

  it('accepts Date object input', () => {
    const result = displayDate(new Date(2003, 5, 15), 'year')
    expect(result).toBe('2003')
  })
})

describe('formatDateRange', () => {
  it('returns "Unknown period" when both null', () => {
    expect(formatDateRange(null, null)).toBe('Unknown period')
  })

  it('formats from-only range', () => {
    const result = formatDateRange('2003-06-15', null)
    expect(result).toContain('present')
  })

  it('formats to-only range', () => {
    const result = formatDateRange(null, '2005-01-01')
    expect(result).toMatch(/^Until/)
  })

  it('formats both dates', () => {
    const result = formatDateRange('2003-06-15', '2005-01-01')
    expect(result).toContain('--')
  })
})

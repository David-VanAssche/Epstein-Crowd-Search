// lib/utils/dates.ts

export type DatePrecision = 'exact' | 'day' | 'month' | 'year' | 'approximate'

/**
 * Parse various date formats commonly found in OCR text.
 * Returns a Date object or null if parsing fails.
 */
export function parseOCRDate(text: string): Date | null {
  const cleaned = text.trim()

  // ISO format: 2003-04-15
  const isoMatch = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) {
    return new Date(cleaned)
  }

  // US format: 04/15/2003, 4/15/03
  const usMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (usMatch) {
    const month = parseInt(usMatch[1], 10)
    const day = parseInt(usMatch[2], 10)
    let year = parseInt(usMatch[3], 10)
    if (year < 100) year += year > 50 ? 1900 : 2000
    return new Date(year, month - 1, day)
  }

  // Written format: April 15, 2003 / Apr 15, 2003
  const writtenMatch = cleaned.match(
    /^(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})$/i
  )
  if (writtenMatch) {
    return new Date(cleaned)
  }

  // Year only: 2003
  const yearMatch = cleaned.match(/^(\d{4})$/)
  if (yearMatch) {
    return new Date(parseInt(yearMatch[1], 10), 0, 1)
  }

  return null
}

/**
 * Determine the precision of a parsed date string.
 */
export function getDatePrecision(text: string): DatePrecision {
  const cleaned = text.trim()

  if (/^\d{4}$/.test(cleaned)) return 'year'
  if (/^(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}$/i.test(cleaned)) return 'month'
  if (/circa|approx|around|about|~|\?/i.test(cleaned)) return 'approximate'
  if (/^\d{4}-\d{2}-\d{2}/.test(cleaned)) return 'exact'

  return 'day'
}

/**
 * Display a date with appropriate precision.
 */
export function displayDate(date: string | Date | null, precision?: DatePrecision): string {
  if (!date) return 'Unknown date'

  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return 'Invalid date'

  switch (precision) {
    case 'year':
      return d.getFullYear().toString()
    case 'month':
      return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    case 'approximate':
      return `c. ${d.getFullYear()}`
    case 'day':
    case 'exact':
    default:
      return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  }
}

/**
 * Format a date range for display.
 */
export function formatDateRange(from: string | null, to: string | null): string {
  if (!from && !to) return 'Unknown period'
  if (from && !to) return `${displayDate(from)} -- present`
  if (!from && to) return `Until ${displayDate(to)}`
  return `${displayDate(from)} -- ${displayDate(to)}`
}

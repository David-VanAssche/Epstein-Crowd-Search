import { describe, it, expect } from 'vitest'
import {
  formatCitation,
  formatCitationWithDataset,
  citationLink,
  parseCitations,
  formatFootnotes,
  type CitationSource,
} from '@/lib/utils/citations'

const makeSource = (overrides: Partial<CitationSource> = {}): CitationSource => ({
  document_id: 'abc-123',
  document_filename: 'flight-log.pdf',
  page_number: 5,
  ...overrides,
})

describe('formatCitation', () => {
  it('formats with page number', () => {
    expect(formatCitation(makeSource())).toBe('[flight-log.pdf, Page 5]')
  })

  it('formats without page number (null)', () => {
    expect(formatCitation(makeSource({ page_number: null }))).toBe('[flight-log.pdf]')
  })

  it('BUG: page_number=0 is suppressed (falsy check)', () => {
    // This documents the existing bug: `if (source.page_number)` treats 0 as falsy
    expect(formatCitation(makeSource({ page_number: 0 }))).toBe('[flight-log.pdf]')
  })

  it('handles special characters in filename', () => {
    expect(formatCitation(makeSource({ document_filename: 'file (copy) [2].pdf' }))).toBe(
      '[file (copy) [2].pdf, Page 5]'
    )
  })
})

describe('formatCitationWithDataset', () => {
  it('appends dataset name when present', () => {
    expect(formatCitationWithDataset(makeSource({ dataset_name: 'Epstein Files' }))).toBe(
      '[flight-log.pdf, Page 5] (Epstein Files)'
    )
  })

  it('omits dataset when null', () => {
    expect(formatCitationWithDataset(makeSource({ dataset_name: null }))).toBe(
      '[flight-log.pdf, Page 5]'
    )
  })

  it('omits dataset when undefined', () => {
    expect(formatCitationWithDataset(makeSource({ dataset_name: undefined }))).toBe(
      '[flight-log.pdf, Page 5]'
    )
  })

  it('handles empty string dataset (truthy)', () => {
    // Empty string is falsy, so no dataset appended
    expect(formatCitationWithDataset(makeSource({ dataset_name: '' }))).toBe(
      '[flight-log.pdf, Page 5]'
    )
  })
})

describe('citationLink', () => {
  it('generates link with page anchor', () => {
    expect(citationLink(makeSource())).toBe('/document/abc-123#page-5')
  })

  it('generates link without anchor when page is null', () => {
    expect(citationLink(makeSource({ page_number: null }))).toBe('/document/abc-123')
  })

  it('BUG: page_number=0 produces no anchor (falsy)', () => {
    expect(citationLink(makeSource({ page_number: 0 }))).toBe('/document/abc-123')
  })
})

describe('parseCitations', () => {
  it('parses single citation with page', () => {
    const result = parseCitations('See [report.pdf, Page 42] for details.')
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ raw: '[report.pdf, Page 42]', filename: 'report.pdf', page: 42 })
  })

  it('parses citation without page', () => {
    const result = parseCitations('See [report.pdf] for details.')
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ raw: '[report.pdf]', filename: 'report.pdf', page: null })
  })

  it('parses multiple citations', () => {
    const result = parseCitations('[doc1.pdf, Page 1] and [doc2.pdf, Page 2]')
    expect(result).toHaveLength(2)
    expect(result[0].filename).toBe('doc1.pdf')
    expect(result[1].filename).toBe('doc2.pdf')
  })

  it('returns empty array for no matches', () => {
    expect(parseCitations('No citations here.')).toEqual([])
  })

  it('trims whitespace from filename', () => {
    const result = parseCitations('[ spaced name.pdf , Page 3]')
    expect(result[0].filename).toBe('spaced name.pdf')
  })

  it('handles large page numbers', () => {
    const result = parseCitations('[doc.pdf, Page 99999]')
    expect(result[0].page).toBe(99999)
  })
})

describe('formatFootnotes', () => {
  it('formats numbered footnote list', () => {
    const sources = [
      makeSource({ document_filename: 'doc1.pdf', page_number: 1 }),
      makeSource({ document_filename: 'doc2.pdf', page_number: null }),
    ]
    expect(formatFootnotes(sources)).toBe('[1] doc1.pdf, p. 1\n[2] doc2.pdf')
  })

  it('returns empty string for empty array', () => {
    expect(formatFootnotes([])).toBe('')
  })
})

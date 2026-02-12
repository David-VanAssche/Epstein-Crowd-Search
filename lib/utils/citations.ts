// lib/utils/citations.ts

export interface CitationSource {
  document_id: string
  document_filename: string
  page_number: number | null
  chunk_id?: string
  dataset_name?: string | null
}

/**
 * Format a citation string: "[Document Name, Page X]"
 */
export function formatCitation(source: CitationSource): string {
  const pagePart = source.page_number ? `, Page ${source.page_number}` : ''
  return `[${source.document_filename}${pagePart}]`
}

/**
 * Format a citation with dataset context: "[Document Name, Page X] (Dataset 3)"
 */
export function formatCitationWithDataset(source: CitationSource): string {
  const base = formatCitation(source)
  if (source.dataset_name) {
    return `${base} (${source.dataset_name})`
  }
  return base
}

/**
 * Generate a clickable citation link path.
 */
export function citationLink(source: CitationSource): string {
  const base = `/document/${source.document_id}`
  if (source.page_number) {
    return `${base}#page-${source.page_number}`
  }
  return base
}

/**
 * Parse citation references from AI-generated text.
 * Looks for patterns like [Document Name, Page X] and extracts them.
 */
export function parseCitations(text: string): Array<{ raw: string; filename: string; page: number | null }> {
  const citationRegex = /\[([^\]]+?)(?:,\s*Page\s*(\d+))?\]/g
  const citations: Array<{ raw: string; filename: string; page: number | null }> = []

  let match
  while ((match = citationRegex.exec(text)) !== null) {
    citations.push({
      raw: match[0],
      filename: match[1].trim(),
      page: match[2] ? parseInt(match[2], 10) : null,
    })
  }

  return citations
}

/**
 * Format multiple citations as a footnote list.
 */
export function formatFootnotes(sources: CitationSource[]): string {
  return sources
    .map((source, i) => `[${i + 1}] ${source.document_filename}${source.page_number ? `, p. ${source.page_number}` : ''}`)
    .join('\n')
}

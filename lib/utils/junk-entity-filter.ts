// lib/utils/junk-entity-filter.ts
// Blocklist of common false-positive entity names produced by OCR + NER.

const JUNK_ENTITIES = new Set([
  // Days of the week
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  // Months
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
  // Document boilerplate
  'united states district court', 'united states of america',
  'southern district of new york', 'southern district of florida',
  'northern district', 'eastern district', 'western district',
  'department of justice', 'federal bureau of investigation',
  'plaintiff', 'defendant', 'petitioner', 'respondent',
  'exhibit', 'deposition', 'testimony', 'declaration',
  'affidavit', 'certificate', 'motion', 'order', 'judgment',
  'stipulation', 'subpoena', 'complaint', 'indictment',
  'court', 'judge', 'attorney', 'counsel', 'esquire',
  'objection', 'sustained', 'overruled', 'sidebar',
  'witness', 'sworn', 'oath', 'perjury',
  'privileged', 'confidential', 'sealed', 'redacted',
  'case no', 'case number', 'docket',
  // Common OCR noise and HTML/CSS
  'arial', 'times new roman', 'helvetica', 'courier',
  'bold', 'italic', 'underline', 'font',
  'page', 'header', 'footer', 'table',
  'div', 'span', 'class', 'style',
  'http', 'https', 'www', 'html', 'pdf',
  // Generic words that aren't entities
  'unknown', 'unnamed', 'unidentified', 'anonymous',
  'john doe', 'jane doe', 'doe',
  'n/a', 'none', 'null', 'undefined', 'other',
  'same', 'above', 'below', 'supra', 'infra',
  'see', 'also', 'note', 'ibid',
  'mr', 'mrs', 'ms', 'dr', 'the',
  // Single-letter and very short
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
  'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
  'id', 'no', 'or', 'an', 'at', 'by', 'do', 'go', 'if', 'in',
  'is', 'it', 'my', 'of', 'on', 'so', 'to', 'up', 'us', 'we',
  // Common false-positive organizations
  'inc', 'llc', 'ltd', 'corp', 'co',
])

/**
 * Returns true if the entity name is a known false positive (junk).
 * Checks normalized lowercase, and rejects single-character or empty names.
 */
export function isJunkEntity(name: string): boolean {
  const normalized = name.trim().toLowerCase()

  // Empty or single character
  if (normalized.length <= 1) return true

  // Pure numbers / dates
  if (/^\d+([/\-.]\d+)*$/.test(normalized)) return true

  // Check blocklist
  if (JUNK_ENTITIES.has(normalized)) return true

  return false
}

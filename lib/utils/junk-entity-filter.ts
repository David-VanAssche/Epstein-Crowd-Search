// lib/utils/junk-entity-filter.ts
// Blocklist of common false-positive entity names produced by OCR + NER.
// Enhanced with patterns from rhowardstone/build_person_registry.py.

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
  // --- rhowardstone-inspired: single common words (build_person_registry.py) ---
  'and', 'but', 'for', 'not', 'you', 'all', 'can', 'had', 'her', 'was',
  'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its',
  'let', 'new', 'now', 'old', 'say', 'she', 'too', 'use', 'way', 'who',
  'did', 'got', 'may', 'any', 'own', 'set', 'sir', 'top', 'yes',
  // Document/legal common words that get extracted as entities
  'chapter', 'section', 'article', 'paragraph', 'clause', 'count',
  'statement', 'report', 'record', 'document', 'evidence', 'charges',
  'allegation', 'response', 'answer', 'brief', 'filing', 'trial',
  'hearing', 'appeal', 'review', 'summary', 'transcript',
  // --- rhowardstone-inspired: role descriptions misidentified as entities ---
  'the defendant', 'the witness', 'the victim', 'the plaintiff',
  'the respondent', 'the petitioner', 'the court', 'the government',
  'unknown male', 'unknown female', 'unidentified male', 'unidentified female',
])

// Jane/John Doe pattern with numbers
const DOE_PATTERN = /^(jane|john)\s+doe\s*#?\d*$/i

// OCR artifacts: only non-alphabetic chars, or just 1-2 uppercase letters
const OCR_ARTIFACT_PATTERN = /^[^a-zA-Z]*$|^[A-Z]{1,2}$/

// Geographic entities that should not be classified as persons
const GEOGRAPHIC_NAMES = new Set([
  // US States
  'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado',
  'connecticut', 'delaware', 'florida', 'georgia', 'hawaii', 'idaho',
  'illinois', 'indiana', 'iowa', 'kansas', 'kentucky', 'louisiana',
  'maine', 'maryland', 'massachusetts', 'michigan', 'minnesota',
  'mississippi', 'missouri', 'montana', 'nebraska', 'nevada',
  'new hampshire', 'new jersey', 'new mexico', 'new york', 'north carolina',
  'north dakota', 'ohio', 'oklahoma', 'oregon', 'pennsylvania',
  'rhode island', 'south carolina', 'south dakota', 'tennessee', 'texas',
  'utah', 'vermont', 'virginia', 'washington', 'west virginia',
  'wisconsin', 'wyoming',
  // Common countries
  'united states', 'united kingdom', 'canada', 'mexico', 'france',
  'germany', 'japan', 'china', 'russia', 'australia', 'brazil',
  'india', 'israel', 'italy', 'spain', 'switzerland', 'sweden',
  // US territories / DC
  'district of columbia', 'puerto rico', 'virgin islands', 'guam',
])

/**
 * Returns true if the entity name is a known false positive (junk).
 * Checks normalized lowercase, and rejects single-character or empty names.
 * Enhanced with rhowardstone patterns for OCR artifacts, role descriptions,
 * single common words, and geographic markers misidentified as persons.
 *
 * @param name - Entity name to check
 * @param entityType - Optional entity type for type-specific filtering
 */
export function isJunkEntity(name: string, entityType?: string): boolean {
  const normalized = name.trim().toLowerCase()

  // Empty or single character
  if (normalized.length <= 1) return true

  // Pure numbers / dates
  if (/^\d+([/\-.]\d+)*$/.test(normalized)) return true

  // OCR artifacts: no alphabetic chars, or just 1-2 uppercase letters
  if (OCR_ARTIFACT_PATTERN.test(name.trim())) return true

  // Check blocklist
  if (JUNK_ENTITIES.has(normalized)) return true

  // Jane/John Doe with optional number
  if (DOE_PATTERN.test(normalized)) return true

  // Single common word check: reject person entities that are a single word
  // and match common dictionary words (not proper names)
  if (entityType === 'person' && !normalized.includes(' ')) {
    if (JUNK_ENTITIES.has(normalized)) return true
  }

  // Geographic markers should not be person entities
  if (entityType === 'person' && GEOGRAPHIC_NAMES.has(normalized)) return true

  return false
}

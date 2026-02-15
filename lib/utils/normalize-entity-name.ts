// lib/utils/normalize-entity-name.ts
// TypeScript mirror of the SQL normalize_entity_name() function.
// Used in the entity-extractor pipeline for consistent matching.

const TITLE_PREFIXES =
  /\b(dr|mr|mrs|ms|prof|sir|hon|rev|gen|col|sgt|lt|cpt|cmdr|adm)\.?\s+/gi

const SUFFIXES =
  /,?\s+(jr\.?|sr\.?|iii|ii|iv|esq\.?|md|ph\.?d\.?)$/gi

export function normalizeEntityName(name: string): string {
  let result = name

  // Strip outer quotes
  result = result.replace(/^["']+|["']+$/g, '')

  // Strip parenthetical content
  result = result.replace(/\([^)]*\)/g, '')

  // Lowercase
  result = result.toLowerCase()

  // Strip titles/prefixes
  result = result.replace(TITLE_PREFIXES, '')

  // Strip suffixes
  result = result.replace(SUFFIXES, '')

  // Flip "Last, First" → "first last"
  if (/^\s*[a-z]+([-'][a-z]+)?\s*,\s*[a-z]/.test(result)) {
    result = result.replace(/^\s*([^,]+),\s*(.+)$/, '$2 $1')
  }

  // Collapse whitespace
  result = result.trim().replace(/\s+/g, ' ')

  return result
}

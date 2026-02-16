// lib/pipeline/prompts/entity-extraction.ts
// Prompt builder for Stage 6: Entity Extraction.
// Pure function — no side effects, no API calls, no DB access.

import type { PromptContext, PromptTier } from './types'
import {
  TIER_PREAMBLES,
  TAG_SUPPLEMENTS,
  ENTITY_PRIORITY_TYPES,
} from './common'

const ENTITY_TYPES = [
  'person', 'organization', 'location', 'aircraft', 'vessel', 'property',
  'account', 'event', 'legal_case', 'government_body', 'trust',
  'phone_number', 'vehicle', 'document_reference',
] as const

const TIER_INSTRUCTIONS: Record<PromptTier, string> = {
  sworn: `This is sworn testimony. Pay special attention to:
- Q&A transcript patterns (THE WITNESS, Q:, A:, BY MR./MS.)
- The deponent/witness name (usually stated at the beginning)
- Attorneys present (both examining and representing)
- People mentioned under oath — these are high-confidence entity mentions
- Referenced third parties, locations, and events described in testimony
- Legal case references mentioned during questioning`,

  official: `This is an official legal/law enforcement document. Pay special attention to:
- Case numbers and legal case references (extract as legal_case entities)
- Judges, magistrates, and court officers
- Attorneys of record for all parties
- Plaintiffs and defendants named in captions — these are high-confidence
- Government agencies and their subdivisions (extract as government_body)
- Dates of filings, hearings, and referenced incidents`,

  flight: `This is a flight log or manifest. Pay special attention to:
- Passenger names (may be abbreviated, initialed, or use nicknames)
- Pilot and crew names
- Aircraft identifiers: tail numbers (N-numbers), aircraft type/model
- Airport and FBO names (3-letter ICAO/IATA codes → extract as location)
- Dates of each flight entry
- Names may be abbreviated (e.g., "JE" for Jeffrey Epstein, "GM" for Ghislaine Maxwell)`,

  financial: `This is a financial record. Pay special attention to:
- Account holders and signatories (extract as person or organization)
- Financial institutions and banks (extract as organization)
- Beneficiaries and trustees
- Shell companies, LLCs, Ltd entities (extract as trust or organization)
- Dollar amounts often imply related account entities
- Wire transfer originators and recipients`,

  correspondence: `This is correspondence (email, letter, memo, or fax). Pay special attention to:
- Sender and recipient from headers (From/To/CC/BCC fields)
- People and organizations mentioned in the body text
- Meeting locations and venues referenced
- Organizational affiliations mentioned in signatures or letterhead
- Third parties discussed or referenced in the content`,

  contacts: `This is a contacts record (address book, phone list, or calendar). Pay special attention to:
- Every entry likely represents a person or organization
- Extract full names, phone numbers, addresses
- Note organizational affiliations listed with entries
- Group or category labels applied to contacts
- Physical addresses (extract as location entities)`,

  default: `Be thorough — extract ALL entities mentioned including people, organizations, locations, aircraft, vessels, properties, accounts, events, legal cases, government bodies, trusts/shell companies, phone numbers, vehicles, and document references.`,
}

export function buildEntityExtractionPrompt(
  ctx: PromptContext,
  chunkContent: string
): string {
  const preamble = TIER_PREAMBLES[ctx.tier]
  const instructions = TIER_INSTRUCTIONS[ctx.tier]
  const priorityTypes = ENTITY_PRIORITY_TYPES[ctx.tier]

  const tagLines = ctx.secondaryTiers
    .map((t) => TAG_SUPPLEMENTS[t])
    .filter(Boolean)
    .map((s) => `\n${s}`)
    .join('')

  const priorityLine =
    priorityTypes.length > 0
      ? `\nFocus especially on these entity types: ${priorityTypes.join(', ')}`
      : ''

  return `${preamble}

Extract all named entities from this document text.

${instructions}
${priorityLine}${tagLines}

Entity types: ${ENTITY_TYPES.join(', ')}

Text:
---
${chunkContent}
---

For each entity found, provide:
- name: The canonical name (e.g., "Jeffrey Epstein" not "Epstein" or "Mr. Epstein")
- type: One of the entity types above
- aliases: Any alternate names/forms used in the text
- mentionText: The exact text mention in the chunk
- contextSnippet: 1-2 sentences surrounding the mention
- confidence: 0.0-1.0 how confident you are this is a real entity

Return JSON:
{
  "entities": [
    {
      "name": "...",
      "type": "...",
      "aliases": ["..."],
      "mentionText": "...",
      "contextSnippet": "...",
      "confidence": 0.95
    }
  ]
}

If no entities found, return { "entities": [] }.`
}

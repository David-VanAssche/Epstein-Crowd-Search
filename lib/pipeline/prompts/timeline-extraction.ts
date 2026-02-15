// lib/pipeline/prompts/timeline-extraction.ts
// Prompt builder for Stage 9: Timeline Extraction.
// Pure function — no side effects, no API calls, no DB access.

import type { PromptContext, PromptTier } from './types'
import { TIER_PREAMBLES, TAG_SUPPLEMENTS } from './common'

const TIER_INSTRUCTIONS: Record<PromptTier, string> = {
  sworn: `This is sworn testimony. For timeline extraction:
- Extract events the witness testifies about, NOT the deposition date itself
- Narrative dates are common: "sometime in 2003", "that summer", "around Christmas"
- Use "approximate" precision for vague temporal references
- Each described incident is a separate event (meetings, trips, encounters)
- Note who was present at each event as described by the witness`,

  official: `This is an official legal document. For timeline extraction:
- Extract precise dates: filing dates, hearing dates, incident dates in charges
- Most dates will have "exact" precision
- Each charge or count may reference specific incident dates
- Court scheduling orders contain future event dates
- Note the distinction between when something happened and when it was filed`,

  flight: `This is a flight log. For timeline extraction:
- Each flight entry is a separate timeline event
- All dates should be "exact" precision
- Include origin, destination, and passengers for each flight event
- Combine departure/arrival into a single event per flight
- Note aircraft tail number in the event description`,

  financial: `This is a financial record. For timeline extraction:
- Each transaction or filing is a separate timeline event
- Transaction dates are typically "exact" precision
- Include amounts, parties, and account information in descriptions
- Tax filing dates vs. the tax year they cover are different events
- Note patterns in transaction timing (clustering, periodicity)`,

  correspondence: `This is correspondence. For timeline extraction:
- The sent/received date from headers is "exact" precision
- Dates referenced in the body may be "approximate" (e.g., "let's meet Thursday")
- Scheduled meetings or events mentioned are separate timeline events
- Note both the communication date and any referenced future/past dates`,

  contacts: `This is a contacts record. For timeline extraction:
- Extract any dated annotations (e.g., "added 2003", "met at party June 2002")
- Most contact entries won't have dates — return empty if none found
- Calendar entries should be extracted as scheduled events`,

  default: `Extract all dated events from this document text.
For each event with a date (explicit or implied), capture the date, its precision, a description of what happened, the event type, location if mentioned, and the names of entities involved.`,
}

export function buildTimelineExtractionPrompt(
  ctx: PromptContext,
  chunkContent: string
): string {
  const preamble = TIER_PREAMBLES[ctx.tier]
  const instructions = TIER_INSTRUCTIONS[ctx.tier]

  const tagLines = ctx.secondaryTiers
    .map((t) => TAG_SUPPLEMENTS[t])
    .filter(Boolean)
    .map((s) => `\n${s}`)
    .join('')

  return `${preamble}

Extract all dated events from this document text.

${instructions}${tagLines}

Text:
---
${chunkContent}
---

For each event with a date (explicit or implied), provide:
- date: ISO 8601 format if possible (e.g., "2003-07-15"), null if no specific date
- datePrecision: "exact", "month", "year", or "approximate"
- dateDisplay: Human-readable date (e.g., "July 15, 2003" or "Summer 2003")
- description: 1-2 sentence description of the event
- eventType: "travel", "meeting", "legal", "communication", "financial", "testimony", "arrest", "other"
- location: Location if mentioned, null otherwise
- entityNames: Names of entities involved

Return JSON: { "events": [...] }
Return { "events": [] } if no dated events found.`
}

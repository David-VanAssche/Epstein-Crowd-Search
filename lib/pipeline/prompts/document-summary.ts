// lib/pipeline/prompts/document-summary.ts
// Prompt builder for Stage 10: Document Summary.
// Pure function — no side effects, no API calls, no DB access.

import type { PromptContext, PromptTier } from './types'
import { TIER_PREAMBLES, TAG_SUPPLEMENTS, ETHICAL_GUIDELINES } from './common'

const TIER_FOCUS: Record<PromptTier, string> = {
  sworn: `This is sworn testimony. For the summary, focus on:
- Who testified (deponent/witness name and role)
- Key topics covered in the examination
- Notable admissions, denials, or evasive answers
- People and events discussed in detail
- Significance: what this testimony reveals about the investigation`,

  official: `This is an official legal document. For the summary, focus on:
- Document type (motion, order, indictment, complaint, report)
- The parties involved (plaintiff/defendant, investigator/subject)
- Legal issues addressed and arguments made
- Outcome or ruling, if any
- Significance: what legal action this document represents`,

  flight: `This is a flight log. For the summary, focus on:
- Date range covered by the log entries
- Total number of flights recorded
- Key routes (most frequent origin-destination pairs)
- Notable passengers (especially repeated names)
- Aircraft used
- Significance: what travel patterns this reveals`,

  financial: `This is a financial record. For the summary, focus on:
- Types of transactions or filings documented
- Total dollar amounts and date ranges
- Key parties (account holders, beneficiaries, institutions)
- Significance: any suspicious patterns (structuring, shell companies, offshore)`,

  correspondence: `This is correspondence. For the summary, focus on:
- Who communicated (sender and recipients)
- Key topics discussed
- Action items or requests made
- Tone and nature of the relationship
- Significance: what this reveals about relationships or activities`,

  contacts: `This is a contacts record. For the summary, focus on:
- Total number of entries
- Notable names and their organizational affiliations
- Geographic distribution of contacts
- Any categorization or grouping present
- Significance: what this contact list reveals about the network`,

  default: `Generate an executive summary covering:
- What this document is and its key content
- The most important people mentioned
- The time period covered
- Why this document matters for the investigation`,
}

export function buildDocumentSummaryPrompt(
  ctx: PromptContext,
  entityNames: string[],
  ocrText: string
): string {
  const preamble = TIER_PREAMBLES[ctx.tier]
  const focus = TIER_FOCUS[ctx.tier]

  const tagLines = ctx.secondaryTiers
    .map((t) => TAG_SUPPLEMENTS[t])
    .filter(Boolean)
    .map((s) => `\n${s}`)
    .join('')

  return `${preamble}

Generate an executive summary of this document.

${focus}${tagLines}

Known entities in this document: ${entityNames.slice(0, 20).join(', ')}

Document text:
---
${ocrText}
---

Provide JSON:
{
  "summary": "<3-5 sentence executive summary of what this document is and its key content>",
  "keyPeople": ["<names of most important people mentioned>"],
  "timePeriod": "<date range covered, e.g. 'March-July 2003' or null>",
  "significance": "<1 sentence on why this document matters for the investigation>",
  "potentialCriminalIndicators": ["<brief descriptions of any content suggesting trafficking, obstruction, conspiracy, or financial crimes>"]
}

${ETHICAL_GUIDELINES}`
}

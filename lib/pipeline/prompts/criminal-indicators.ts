// lib/pipeline/prompts/criminal-indicators.ts
// Prompt builder for Stage 11: Criminal Indicator Scoring.
// Pure function — no side effects, no API calls, no DB access.

import type { PromptContext, PromptTier } from './types'
import { TIER_PREAMBLES, TAG_SUPPLEMENTS, ETHICAL_GUIDELINES } from './common'

const INDICATOR_CATEGORIES = [
  'trafficking',
  'obstruction',
  'conspiracy',
  'financial_crimes',
  'witness_tampering',
  'exploitation',
] as const

const TIER_FOCUS: Record<PromptTier, string> = {
  sworn: `This is sworn testimony — the highest-quality evidence source. Focus on:
- Direct testimony about trafficking or abuse (victims naming perpetrators, locations, dates)
- Admissions of obstruction (destroying evidence, coaching witnesses, "I don't recall" patterns)
- Conspiracy evidence described under oath (coordination, planning, cover-ups)
- Witness descriptions of exploitation or grooming patterns
- Flag specific sworn statements with exact quotes — these carry maximum evidentiary weight.`,

  official: `This is an official legal document. Focus on:
- Charges listed in indictments (specific counts, statutory references)
- Sealed motions or protective orders (potential evidence of cover-ups)
- Warrant targets and seized items described
- Plea terms (cooperation agreements, admitted crimes, immunity grants)
- Sentencing details and conditions
- Government allegations in complaints or information documents`,

  financial: `This is a financial record. Focus on:
- Structuring: splits below $10,000 reporting threshold (BSA/CTR violations)
- Shell company transfers between related entities
- Offshore account activity (especially Caribbean, Swiss, or Channel Islands)
- Unreported income or asset concealment
- Suspicious round-number transfers with no clear business purpose
- Payments to potential victims or witnesses (hush money patterns)`,

  correspondence: `This is correspondence. Focus on:
- Obstruction: references to destroying evidence, deleting records, or "cleaning up"
- Witness tampering: threats, payments for silence, coaching language
- Conspiracy: planning criminal activity, coded language, euphemisms
- Grooming patterns: progressive boundary-testing language with potential victims
- Cover-up coordination between co-conspirators`,

  contacts: '', // Skip — criminal indicators in address books are not meaningful

  flight: `This is a flight log. Focus on:
- Travel patterns involving known minor victims
- Flights to locations associated with exploitation (private islands, remote estates)
- Unusual passenger combinations (minors with adult males, no guardians)
- Frequency patterns suggesting trafficking routes`,

  default: `Check for these categories of criminal indicators:
- trafficking: travel patterns with minors, exploitation language, grooming indicators
- obstruction: document destruction references, witness intimidation, evidence concealment
- conspiracy: coordination language, coded communication, planning references
- financial_crimes: money laundering patterns, hidden assets, unreported transfers
- witness_tampering: threats to witnesses, incentives for silence, intimidation
- exploitation: power dynamics, coercion references, abuse indicators`,
}

export function buildCriminalIndicatorPrompt(
  ctx: PromptContext,
  entities: string[],
  ocrText: string
): string {
  // Contacts tier: no meaningful criminal indicators to extract
  if (ctx.tier === 'contacts') {
    return ''
  }

  const preamble = TIER_PREAMBLES[ctx.tier]
  const focus = TIER_FOCUS[ctx.tier]

  const tagLines = ctx.secondaryTiers
    .map((t) => TAG_SUPPLEMENTS[t])
    .filter(Boolean)
    .map((s) => `\n${s}`)
    .join('')

  return `${preamble}

Analyze this document for patterns that may indicate criminal activity.

${focus}${tagLines}

Categories: ${INDICATOR_CATEGORIES.join(', ')}

Known entities in document: ${entities.slice(0, 10).join(', ')}

Document text:
---
${ocrText}
---

For each indicator found, provide:
- category: one of the categories above
- severity: "low", "medium", or "high"
- description: what pattern was detected and why it's notable
- evidenceSnippet: the relevant text excerpt (max 200 chars)
- confidence: 0.0-1.0

${ETHICAL_GUIDELINES}

Return JSON: { "indicators": [...] }
Return { "indicators": [] } if no indicators found.`
}

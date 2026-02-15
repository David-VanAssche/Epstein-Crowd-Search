// lib/pipeline/prompts/relationship-mapping.ts
// Prompt builder for Stage 7: Relationship Mapping.
// Pure function — no side effects, no API calls, no DB access.

import type { PromptContext, PromptTier } from './types'
import {
  TIER_PREAMBLES,
  TAG_SUPPLEMENTS,
  RELATIONSHIP_TYPES_BY_TIER,
} from './common'

const TIER_GUIDANCE: Record<PromptTier, string> = {
  sworn:
    'Testimony directly describes interactions, abuses, introductions, and criminal co-participation under oath. Witnesses often describe who introduced them to whom, who was present at events, and the nature of relationships.',

  official:
    'Legal documents establish formal relationships between parties in proceedings. Court filings name co-defendants, attorneys represent specific parties, and government agencies investigate or prosecute specific individuals.',

  flight:
    'Shared flights establish traveled_with relationships. Pilot-to-aircraft-owner is employed_by. Frequent co-passengers are associate_of. Hosts who arranged travel are guest_of.',

  financial:
    'Follow the money: who pays whom (financial_connection), who benefits (beneficiary_of), who controls entities (controlled_by), who owns assets (owns). Transaction patterns reveal employer/employee and principal/agent relationships.',

  correspondence:
    'Sender and recipients communicated_with each other. The body text may reference meetings (met_with), introductions (introduced_by), or describe other relationships between third parties.',

  contacts:
    'Address book entries imply association (associate_of). Shared addresses or phone numbers suggest family_member or co-location (located_at). Organizational labels suggest employed_by.',

  default:
    'Identify all relationships between entities clearly supported by the text.',
}

export function buildRelationshipMappingPrompt(
  ctx: PromptContext,
  entityNames: string[],
  chunkContent: string
): string {
  const preamble = TIER_PREAMBLES[ctx.tier]
  const tierData = RELATIONSHIP_TYPES_BY_TIER[ctx.tier]
  const guidance = TIER_GUIDANCE[ctx.tier]

  const tagLines = ctx.secondaryTiers
    .map((t) => TAG_SUPPLEMENTS[t])
    .filter(Boolean)
    .map((s) => `\n${s}`)
    .join('')

  const focusLine =
    tierData.primary.length > 0
      ? `Focus especially on: ${tierData.primary.join(', ')}`
      : ''

  return `${preamble}

Given this text and the entities mentioned in it, identify relationships between entity pairs.

${guidance}
${focusLine}${tagLines}

Entities present: ${entityNames.join(', ')}

Relationship types: ${tierData.all.join(', ')}

Use other relationship types if the specific semantic relationship is explicitly stated in the text.

Text:
---
${chunkContent}
---

For each relationship found, provide:
- entityA: name of first entity
- entityB: name of second entity
- type: one of the relationship types above
- description: 1 sentence describing the relationship evidence
- confidence: 0.0-1.0

Return JSON array:
[{"entityA":"...","entityB":"...","type":"...","description":"...","confidence":0.8}]

Return [] if no relationships found. Only include relationships clearly supported by the text.`
}

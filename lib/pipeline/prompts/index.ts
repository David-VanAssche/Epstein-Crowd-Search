// lib/pipeline/prompts/index.ts
// Barrel export for prompt system.

export { PROMPT_VERSION, buildPromptContext, classificationToTier } from './types'
export type { PromptTier, PromptContext } from './types'

export {
  TIER_PREAMBLES,
  TAG_SUPPLEMENTS,
  ETHICAL_GUIDELINES,
  RELATIONSHIP_TYPES_BY_TIER,
  ENTITY_PRIORITY_TYPES,
} from './common'

// Prompt builders (added in Phase 2)
export { buildEntityExtractionPrompt } from './entity-extraction'
export { buildRelationshipMappingPrompt } from './relationship-mapping'
export { buildCriminalIndicatorPrompt } from './criminal-indicators'
export { buildTimelineExtractionPrompt } from './timeline-extraction'
export { buildDocumentSummaryPrompt } from './document-summary'

# Phase 1: Prompt Foundation

**Status:** `[ ] Not Started`
**Depends on:** Phase 0 (need canonical relationship type list)
**Blocks:** Phase 2 (prompt builders import from these files)

## Objective

Create the foundational types, tier mapping, and shared prompt fragments that all 5 prompt builders will use.

## Document Tiers

| Tier | Document Types | Prompt Focus |
|------|---------------|--------------|
| `sworn` | deposition, grand_jury_testimony, witness_statement, plea_agreement | Q&A transcript format, testimony under oath |
| `official` | court_filing, indictment, subpoena, search_warrant, police_report, fbi_report, government_report | Formal legal language, case numbers |
| `flight` | flight_log | Tabular passenger lists, tail numbers |
| `financial` | financial_record, tax_filing, trust_document, corporate_filing, receipt_invoice | Amounts, accounts, institutions |
| `correspondence` | email, letter, memo, fax, correspondence | Headers, sender/recipient |
| `contacts` | address_book, phone_record, calendar_schedule | Structured contact data |
| `default` | photograph, news_clipping, medical_record, property_record, other | Current generic prompt |

## Tasks

### 1.1 Create `lib/pipeline/prompts/types.ts`

- [ ] Define `PromptTier` union type (7 tiers)
- [ ] Define `PromptContext` interface:
  ```typescript
  interface PromptContext {
    primary: DocumentType
    primaryConfidence: number
    tags: DocumentType[]
    tier: PromptTier
    secondaryTiers: PromptTier[]  // deduped, excludes primary tier
    documentId: string
    filename: string
  }
  ```
- [ ] Implement `classificationToTier(type: DocumentType): PromptTier` — const Record map
- [ ] Implement `buildPromptContext(primary, tags, metadata)` with:
  - Confidence gating: if `primaryConfidence < 0.4`, force `tier: 'default'`
  - Tag sanitization: filter to valid DocumentType values
  - Secondary tier dedup: `[...new Set(tags.map(classificationToTier))].filter(t => t !== tier)`
  - Cap secondary tiers at 2 (highest probative weight first)
- [ ] Export `PROMPT_VERSION` const (start at `'2.0.0'` — current inline prompts are implicitly v1)

### 1.2 Create `lib/pipeline/prompts/common.ts`

- [ ] `TIER_PREAMBLES: Record<PromptTier, string>` — one-sentence context for each tier
- [ ] `TAG_SUPPLEMENTS: Record<PromptTier, string>` — short disambiguation hints for secondary tiers
- [ ] `ETHICAL_GUIDELINES` — shared text for criminal indicators + summarizer:
  `"IMPORTANT: Flag patterns for human review only. Do NOT make accusations. Be factual and cite specific text."`
- [ ] `RELATIONSHIP_TYPES_BY_TIER: Record<PromptTier, { primary: string[]; descriptions: Record<string, string> }>` — per-tier relationship type ranking with descriptions (all types available, primary ones listed first with "focus especially on")
- [ ] `ENTITY_PRIORITY_TYPES: Record<PromptTier, string[]>` — per-tier entity type prioritization

### 1.3 Create `lib/pipeline/prompts/index.ts`

- [ ] Barrel export: types, common, PROMPT_VERSION
- [ ] (Prompt builder re-exports added in Phase 2)

### 1.4 Build gate
- [ ] `pnpm build` passes clean

## Key Design Decisions (from council review)

1. **All relationship types always available** — tier just controls which are listed first with "focus especially on" guidance. Prevents false negatives from type subsetting.
2. **Confidence gating** — low-confidence classifications fall back to default tier to prevent misrouting.
3. **Tag cap at 2** — prevents prompt bloat and conflicting instructions.
4. **Tags are disambiguation hints only** — secondary tier text says "This document also contains elements of X. When encountering Y patterns, apply Z interpretation." NOT full alternative extraction instructions.

## Done Criteria

- [ ] `types.ts` compiles, `buildPromptContext` handles edge cases (null tags, unknown types, low confidence)
- [ ] `common.ts` has all shared fragments
- [ ] `index.ts` exports everything
- [ ] Build passes

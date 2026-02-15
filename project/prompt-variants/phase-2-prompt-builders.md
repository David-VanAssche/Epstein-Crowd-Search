# Phase 2: Prompt Builders

**Status:** `[ ] Not Started`
**Depends on:** Phase 1 (imports types + common fragments)
**Blocks:** Phase 3 (service wiring imports builders)

## Objective

Create 5 prompt builder files, one per LLM stage. Each exports a pure function that takes `PromptContext` + stage-specific args and returns the complete prompt string.

## Architecture

Each builder follows this composition pattern:
```
1. Tier preamble (from common.ts)
2. Tier-specific extraction instructions
3. Tag supplement lines (from common.ts, max 2)
4. Base schema (entity types / relationship types / output format)
5. Document text
6. Output format specification (JSON)
```

All builders are **pure functions** — no side effects, no API calls, no DB access. This makes them testable in isolation.

## Tasks

### 2.1 Create `lib/pipeline/prompts/entity-extraction.ts`

- [ ] Export `buildEntityExtractionPrompt(ctx: PromptContext, chunkContent: string): string`
- [ ] Tier-specific instructions:

| Tier | Focus |
|------|-------|
| `sworn` | Q&A patterns (THE WITNESS, Q:, A:, BY MR./MS.), deponent name, attorneys, people mentioned under oath, referenced third parties. High confidence for explicitly named people. |
| `official` | Case numbers (legal_case), judges, attorneys of record, plaintiffs/defendants, government agencies. Caption parties are high-confidence. |
| `flight` | Passenger names, pilot names, aircraft tail numbers (N-numbers → aircraft type), airport/FBO names (3-letter codes → location), dates. Names may be abbreviated/initialed. |
| `financial` | Account holders, financial institutions, beneficiaries, trustees, shell companies (LLC/Ltd/Inc → trust or organization). Dollar amounts imply account entities. |
| `correspondence` | Sender/recipient from headers, CC/BCC names, people/orgs mentioned in body, meeting locations referenced. |
| `contacts` | Every entry is likely a person or organization. Extract full names, phone numbers, addresses, organizational affiliations. |
| `default` | Current generic: "Be thorough — extract ALL entities mentioned." |

- [ ] Include `ENTITY_PRIORITY_TYPES` for tier — "Focus especially on: person, legal_case, event" (for sworn)
- [ ] Include tag supplements for secondary tiers
- [ ] Preserve existing output JSON schema (name, type, aliases, mentionText, contextSnippet, confidence)

### 2.2 Create `lib/pipeline/prompts/relationship-mapping.ts`

- [ ] Export `buildRelationshipMappingPrompt(ctx: PromptContext, entityNames: string[], chunkContent: string): string`
- [ ] **Critical:** Present ALL relationship types (full canonical list from types/entities.ts), but rank tier-relevant types first with "Focus especially on" guidance
- [ ] Tier-specific guidance:

| Tier | Primary Types (listed first) | Guidance |
|------|------------------------------|----------|
| `sworn` | victim_of, recruited_by, witness_testimony, co_defendant, associate_of, introduced_by, met_with | "Testimony directly describes interactions, abuses, introductions, and criminal co-participation under oath." |
| `official` | co_defendant, legal_representative, prosecuted_by, investigated_by, witness_testimony, victim_of | "Legal documents establish formal relationships between parties in proceedings." |
| `flight` | traveled_with, employed_by, associate_of, guest_of | "Shared flights establish traveled_with. Pilot-owner is employed_by." |
| `financial` | financial_connection, employed_by, beneficiary_of, controlled_by, owns | "Follow the money: who pays whom, who benefits, who controls." |
| `correspondence` | communicated_with, met_with, associate_of, introduced_by | "Sender/recipients communicated_with each other. Body may reference meetings or introductions." |
| `contacts` | associate_of, family_member, employed_by, located_at | "Address book implies association. Shared addresses imply family/co-location." |
| `default` | (all types, alphabetical) | Full generic prompt |

- [ ] Always include: "Use other relationship types if the specific semantic relationship is explicitly stated in the text."
- [ ] Preserve output JSON schema (entityA, entityB, type, description, confidence)

### 2.3 Create `lib/pipeline/prompts/criminal-indicators.ts`

- [ ] Export `buildCriminalIndicatorPrompt(ctx: PromptContext, entities: string[], ocrText: string): string`
- [ ] Include `ETHICAL_GUIDELINES` from common.ts
- [ ] Tier-specific indicator focus:

| Tier | Focus |
|------|-------|
| `sworn` | Direct testimony about trafficking/abuse (victims, locations, dates), admissions of obstruction, conspiracy evidence described under oath. Highest-quality evidence — flag specific sworn statements with exact quotes. |
| `official` | Charges in indictments, sealed motions (cover-ups), warrant targets (seized items), plea terms (cooperation, admitted crimes), sentencing details. |
| `financial` | Structuring (splits below $10K), shell company transfers, offshore accounts, unreported income, suspicious round-number transfers, BSA/CTR violations. |
| `correspondence` | Obstruction (destroying evidence, coaching witnesses), witness tampering (threats, payments for silence), conspiracy (planning, coded language), grooming patterns. |
| `contacts` | Skip — criminal indicators in address books are not meaningful. Return empty. |
| `default` | Current 6-category generic prompt. |

- [ ] Preserve output JSON schema (category, severity, description, evidenceSnippet, confidence)

### 2.4 Create `lib/pipeline/prompts/timeline-extraction.ts`

- [ ] Export `buildTimelineExtractionPrompt(ctx: PromptContext, chunkContent: string): string`
- [ ] Tier-specific date handling:

| Tier | Focus |
|------|-------|
| `sworn` | Narrative dates ("sometime in 2003", "that summer"). Extract events testified about, not deposition date. Use 'approximate' for vague references. |
| `official` | Precise dates: filing dates, hearing dates, incident dates in charges. Use 'exact' precision. |
| `flight` | Per-flight dates with origin/destination/passengers. Each flight is a separate event. All 'exact'. |
| `financial` | Transaction dates, filing dates. Each transaction is a separate event. Most 'exact'. |
| `correspondence` | Sent date from headers (exact). Body dates may be approximate ("let's meet Thursday"). |
| `default` | Current generic prompt. |

- [ ] Preserve output JSON schema (date, datePrecision, dateDisplay, description, eventType, location, entityNames)

### 2.5 Create `lib/pipeline/prompts/document-summary.ts`

- [ ] Export `buildDocumentSummaryPrompt(ctx: PromptContext, entityNames: string[], ocrText: string): string`
- [ ] Include `ETHICAL_GUIDELINES` for potentialCriminalIndicators field
- [ ] Tier-specific summary focus:

| Tier | Focus |
|------|-------|
| `sworn` | Who testified (deponent), key topics, notable admissions/denials, people/events discussed. Significance: what this testimony reveals. |
| `official` | Document type (motion/order/indictment), parties, legal issues, outcome/ruling. Significance: what legal action this represents. |
| `flight` | Date range, total flights, key routes, notable passengers, aircraft. Significance: travel patterns. |
| `financial` | Transaction types, total amounts, key parties, date range. Significance: suspicious patterns. |
| `correspondence` | Who communicated, key topics, action items, tone. Significance: what this reveals about relationships. |
| `default` | Current generic prompt. |

- [ ] Preserve output JSON schema (summary, keyPeople, timePeriod, significance, potentialCriminalIndicators)

### 2.6 Update `lib/pipeline/prompts/index.ts`

- [ ] Re-export all 5 builder functions
- [ ] Re-export `buildPromptContext`, `PROMPT_VERSION`, `PromptContext`, `PromptTier`

### 2.7 Build gate
- [ ] `pnpm build` passes clean

### 2.8 Agent review
- [ ] Submit all 5 prompt builder files to **CodeReviewer** (GPT-5.2-Codex) for review
- [ ] Focus areas: prompt quality, type safety, composition correctness, edge cases
- [ ] Address critical/important findings

## Done Criteria

- [ ] All 5 builders compile and export correctly
- [ ] Each builder produces different output for each tier (verifiable by inspection)
- [ ] Tag supplements compose correctly without conflicting instructions
- [ ] Ethical guidelines present in criminal-indicators and document-summary
- [ ] Build passes
- [ ] Agent review complete

# Phase E: AI Entity Summaries

## Status: NOT STARTED

## Problem

Every entity has a `description` field that's always NULL. The EntityProfile Overview tab shows:

```
"AI-generated summary will appear once this entity is fully analyzed."
```

The document-level summarizer exists (`lib/pipeline/services/document-summarizer.ts`) and stores summaries in `documents.metadata.summary`. But there is no entity-level summarizer that aggregates across all documents mentioning an entity to produce a biographical/organizational summary.

This is the single biggest gap in the entity system — without it, entity pages feel empty and unexplored.

---

## Design

### The Entity Summary Pipeline

A new pipeline service that runs **after** all documents are processed (not per-document, but per-entity). It:

1. Gathers the top N strongest mentions for an entity (by evidence_weight)
2. Pulls the context snippets and document summaries for those mentions
3. Sends to Gemini Flash with a structured prompt
4. Stores the result in `entities.description`

This is fundamentally different from existing pipeline stages (which run per-document). This is a **batch entity-level** stage.

### When to Run

Two modes:
- **Incremental**: After a document completes processing, queue affected entities for summary regeneration
- **Batch**: Run across all entities with >N mentions that have NULL or stale descriptions

---

## Changes

### 1. Migration: Entity Summary Metadata

**New file: `supabase/migrations/00029_entity_summaries.sql`**

```sql
-- Track summary generation metadata
ALTER TABLE entities ADD COLUMN IF NOT EXISTS summary_model TEXT;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS summary_generated_at TIMESTAMPTZ;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS summary_source_count INTEGER DEFAULT 0;
-- description column already exists (TEXT, nullable)
```

### 2. Entity Summary Service

**New file: `lib/pipeline/services/entity-summarizer.ts`**

```typescript
export async function generateEntitySummary(
  entityId: string,
  supabase: SupabaseClient
): Promise<void>
```

Logic:

1. **Fetch entity**: name, entity_type, category, aliases, risk_score, mention_count, document_count
2. **Fetch top 30 mentions** by evidence_weight DESC, with context_snippet and document info:
   ```sql
   SELECT em.mention_text, em.context_snippet, em.mention_type,
          em.evidence_weight, em.page_number,
          d.filename, d.classification, d.metadata->>'summary' AS doc_summary
   FROM entity_mentions em
   JOIN documents d ON d.id = em.document_id
   WHERE em.entity_id = $1
   ORDER BY em.evidence_weight DESC NULLS LAST
   LIMIT 30
   ```
3. **Fetch relationships** (top 10 by strength):
   ```sql
   SELECT er.relationship_type, er.description, er.strength,
          CASE WHEN er.entity_a_id = $1 THEN eb.name ELSE ea.name END AS related_name
   FROM entity_relationships er
   LEFT JOIN entities ea ON ea.id = er.entity_a_id
   LEFT JOIN entities eb ON eb.id = er.entity_b_id
   WHERE er.entity_a_id = $1 OR er.entity_b_id = $1
   ORDER BY er.strength DESC
   LIMIT 10
   ```
4. **Fetch timeline events** (up to 10):
   ```sql
   SELECT date_display, description, event_type, location
   FROM timeline_events
   WHERE entity_ids @> ARRAY[$1]::uuid[]
   ORDER BY event_date ASC NULLS LAST
   LIMIT 10
   ```
5. **Build prompt** and call Gemini 2.0 Flash:

```
Generate a comprehensive summary of this {entity_type} based on evidence from the Epstein document archive.

Entity: {name}
Type: {entity_type}
Category: {category}
Aliases: {aliases}
Mentioned in {document_count} documents, {mention_count} total mentions
Risk Score: {risk_score}/5.0

=== KEY DOCUMENT MENTIONS ===
{For each mention: "In {filename} ({classification}): {context_snippet}"}

=== DOCUMENT SUMMARIES ===
{For each unique doc with summary: "{filename}: {doc_summary}"}

=== KNOWN RELATIONSHIPS ===
{For each: "{relationship_type} with {related_name} (strength: {strength})"}

=== TIMELINE ===
{For each: "{date_display}: {description} [{event_type}] at {location}"}

Write a factual, evidence-based summary in 3-6 paragraphs:
1. Who/what this entity is and their role in the Epstein case
2. Key documented activities and connections
3. Notable evidence from documents
4. Timeline of involvement (if events exist)

Rules:
- Only state what is documented in the evidence provided
- Use phrases like "documents indicate", "according to testimony", "records show"
- Never make accusations — describe what documents contain
- If evidence is thin, say so: "Limited documentation exists for..."
- For persons: include known roles, relationships, and documented activities
- For organizations: include purpose, key personnel, and documented activities
- For locations: include significance, documented events, and associated persons

Return JSON:
{
  "summary": "<the full summary text>",
  "confidence": <0.0-1.0 based on evidence quality/quantity>,
  "key_facts": ["<3-5 bullet point key facts>"]
}
```

6. **Store result**:
   ```sql
   UPDATE entities SET
     description = $summary,
     summary_model = 'gemini-2.0-flash',
     summary_generated_at = now(),
     summary_source_count = $source_count,
     metadata = metadata || jsonb_build_object(
       'summary_confidence', $confidence,
       'summary_key_facts', $key_facts
     )
   WHERE id = $entity_id
   ```

### 3. Batch Summary Script

**New file: `scripts/generate-entity-summaries.ts`**

CLI script for batch summary generation:

```
npx tsx scripts/generate-entity-summaries.ts [options]

Options:
  --min-mentions N    Only summarize entities with >= N mentions (default: 3)
  --type TYPE         Only summarize entities of this type
  --force             Regenerate even if description exists
  --limit N           Process at most N entities (default: 100)
  --dry-run           Show what would be processed without calling AI
```

Logic:
1. Query entities matching criteria, ordered by mention_count DESC
2. Filter to those with NULL description (unless --force)
3. Process sequentially with 500ms delay between API calls
4. Print progress: `[42/100] Generating summary for Jeffrey Epstein (person, 847 mentions)...`
5. On error: log and continue to next entity

### 4. Incremental Trigger (via Pipeline)

**Modified: `lib/pipeline/stages.ts`**

Add `ENTITY_SUMMARY` stage after `RISK_SCORE`:

```typescript
{
  stage: PipelineStage.ENTITY_SUMMARY,
  label: 'Entity Summary Generation',
  description: 'Generate AI summaries for entities with sufficient evidence',
  dependsOn: [PipelineStage.RISK_SCORE],
  estimatedCostPerPage: 0.001,
  idempotent: true,
  maxRetries: 2,
}
```

**New handler: `lib/pipeline/services/entity-summary-handler.ts`**

When a document completes processing:
1. Find all entities mentioned in this document
2. For each entity with `mention_count >= 3` AND (`description IS NULL` OR `summary_generated_at < now() - interval '7 days'`):
3. Queue for summary generation (call `generateEntitySummary`)
4. Cap at 5 entities per document to avoid cost explosion

### 5. UI Changes

**Modified: `components/entity/EntityProfile.tsx`**

The Overview tab already shows `entity.description` — just need to enhance the display:

```tsx
{entity.description ? (
  <div className="space-y-4">
    <div className="prose prose-sm dark:prose-invert max-w-none">
      {entity.description.split('\n\n').map((paragraph, i) => (
        <p key={i}>{paragraph}</p>
      ))}
    </div>
    {entity.summary_generated_at && (
      <p className="text-xs text-muted-foreground">
        AI summary generated {formatRelativeTime(entity.summary_generated_at)}
        {entity.summary_source_count && ` from ${entity.summary_source_count} sources`}
      </p>
    )}
    {entity.metadata?.summary_key_facts && (
      <div className="rounded-lg border border-border p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Key Facts</p>
        <ul className="space-y-1 text-sm">
          {(entity.metadata.summary_key_facts as string[]).map((fact, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-1 text-accent">•</span>
              <span>{fact}</span>
            </li>
          ))}
        </ul>
      </div>
    )}
  </div>
) : (
  <p className="text-muted-foreground">
    AI-generated summary will appear once this entity is fully analyzed.
  </p>
)}
```

**Modified: `components/entity/EntityCard.tsx`**

Show first ~100 chars of description under the entity name:

```tsx
{entity.description && (
  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
    {entity.description}
  </p>
)}
```

This requires adding `description` to the list API select.

**Modified: `app/api/entity/route.ts`**

Add `description` to the select:
```typescript
.select('id, name, entity_type, mention_count, document_count, risk_score, photo_url, description')
```

### 6. Type Updates

**Modified: `types/entities.ts`**

Add to `Entity` interface:
```typescript
summary_model: string | null
summary_generated_at: string | null
summary_source_count: number
```

---

## Cost Estimate

- Gemini 2.0 Flash: ~$0.001 per entity summary (prompt ~2K tokens, response ~500 tokens)
- For 46K entities: $46 if processing all (but most won't have 3+ mentions)
- Realistic: ~5K entities with 3+ mentions = ~$5 total
- The 500ms delay per entity means batch processing ~5K entities takes ~42 minutes

---

## Files Summary

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/00029_entity_summaries.sql` | NEW | Add summary metadata columns |
| `lib/pipeline/services/entity-summarizer.ts` | NEW | Core summary generation service |
| `lib/pipeline/services/entity-summary-handler.ts` | NEW | Pipeline stage handler |
| `scripts/generate-entity-summaries.ts` | NEW | Batch CLI script |
| `lib/pipeline/stages.ts` | MODIFY | Add ENTITY_SUMMARY stage |
| `components/entity/EntityProfile.tsx` | MODIFY | Enhanced description display |
| `components/entity/EntityCard.tsx` | MODIFY | Description excerpt |
| `app/api/entity/route.ts` | MODIFY | Add description to select |
| `types/entities.ts` | MODIFY | Add summary fields |

## Dependencies

- Requires entity_mentions to be populated (pipeline must have run)
- Best run after Phases A-D so the full entity UI is ready
- Independent of Phases F-G

## Estimated Effort

Medium. The summarizer prompt engineering is the main creative work. The pipeline integration follows established patterns exactly.

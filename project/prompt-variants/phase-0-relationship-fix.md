# Phase 0: Relationship Type Alignment

**Status:** `[ ] Not Started`
**Depends on:** Nothing
**Blocks:** Phase 3 (service wiring — relationship mapper specifically)

## Objective

Fix the relationship type mismatch between the mapper service (11 types), the TypeScript type union (20 types), and the actual database data. This must happen BEFORE prompt variants because the prompt builders need a canonical relationship type list.

## Background

The relationship mapper (`relationship-mapper.ts`) hardcodes 11 types. The TypeScript type union (`types/entities.ts`) has 20. Four mapper types don't exist in the type union:

| Mapper Has | DB Type Should Be | Action |
|------------|-------------------|--------|
| `communicated_with` | (new) | Add to `types/entities.ts` |
| `met_with` | (new) | Add to `types/entities.ts` |
| `referenced_together` | `mentioned_together` | Rename in mapper + migrate data |
| `witness_against` | `witness_testimony` | Rename in mapper + migrate data |

The DB column is `TEXT NOT NULL` with no CHECK constraint, so any string is accepted.

## Tasks

### 0.1 Audit existing data
- [ ] Run SQL to see what relationship types actually exist in the database:
  ```sql
  SELECT relationship_type, COUNT(*)
  FROM entity_relationships
  GROUP BY relationship_type
  ORDER BY count DESC;
  ```
- [ ] Document findings in this file (paste output below)

**Audit results:** _(paste here during implementation)_

### 0.2 Create SQL migration
- [ ] Create `supabase/migrations/00031_relationship_types_align.sql`
- [ ] Rename `referenced_together` → `mentioned_together` in `entity_relationships`
- [ ] Rename `witness_against` → `witness_testimony` in `entity_relationships`
- [ ] Add verification block to confirm no orphaned old types remain
- [ ] Handle UNIQUE constraint: if renaming creates a duplicate `(entity_a_id, entity_b_id, relationship_type)`, keep the higher-confidence row

### 0.3 Update TypeScript types
- [ ] In `types/entities.ts`: add `communicated_with` and `met_with` to `RelationshipType` union
- [ ] Verify the full canonical list matches what the prompt builders will use

### 0.4 Build gate
- [ ] `pnpm build` passes clean

### 0.5 Agent review
- [ ] Submit Phase 0 changes to **CodeReviewer** (GPT-5.2-Codex) for review
- [ ] Address any critical/important findings

## Done Criteria

- [ ] SQL migration exists and handles renames + dedup
- [ ] `types/entities.ts` has complete canonical list (22 types)
- [ ] Build passes
- [ ] Agent review complete, no open criticals
